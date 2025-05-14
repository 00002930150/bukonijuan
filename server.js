// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'buko_juice_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Access denied' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// AUTH ROUTES
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '8h' }
    );
    
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role || 'staff']
    );
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// PRODUCT ROUTES
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products WHERE active = TRUE');
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { category, name, size, price } = req.body;
    
    // Insert product
    const [result] = await pool.query(
      'INSERT INTO products (category, name, size, price) VALUES (?, ?, ?, ?)',
      [category, name, size, price]
    );
    
    // Initialize inventory for the new product
    await pool.query(
      'INSERT INTO inventory (product_id, quantity) VALUES (?, 0)',
      [result.insertId]
    );
    
    res.status(201).json({ 
      id: result.insertId,
      category,
      name,
      size,
      price
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// INVENTORY ROUTES
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const [inventory] = await pool.query(`
      SELECT i.*, p.name, p.category, p.size 
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.active = TRUE
    `);
    res.json(inventory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const { quantity } = req.body;
    const { id } = req.params;
    
    await pool.query(
      'UPDATE inventory SET quantity = ? WHERE id = ?',
      [quantity, id]
    );
    
    res.json({ message: 'Inventory updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// SALES ROUTES
app.post('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { sale_date, items } = req.body;
    const userId = req.user.id;
    
    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Create sale record
      const [saleResult] = await connection.query(
        'INSERT INTO sales (sale_date, user_id, total_amount) VALUES (?, ?, ?)',
        [sale_date, userId, totalAmount]
      );
      
      const saleId = saleResult.insertId;
      
      // Add sale items
      for (const item of items) {
        await connection.query(
          'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
          [saleId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
        
        // Update inventory
        await connection.query(
          'UPDATE inventory SET quantity = quantity - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }
      
      await connection.commit();
      
      res.status(201).json({ 
        id: saleId,
        total_amount: totalAmount,
        message: 'Sale recorded successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/sales/report', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    
    // Get sales summary
    const [salesSummary] = await pool.query(`
      SELECT 
        p.category, 
        p.name, 
        p.size, 
        SUM(si.quantity) as quantity_sold,
        SUM(si.subtotal) as total
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE DATE(s.sale_date) = ?
      GROUP BY p.category, p.name, p.size
      ORDER BY p.category, p.name, p.size
    `, [date]);
    
    // Get totals
    const [totals] = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.id) as transactions,
        SUM(si.quantity) as units_sold,
        COUNT(DISTINCT si.product_id) as products_sold,
        SUM(s.total_amount) as total_sales
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) = ?
    `, [date]);
    
    res.json({
      date,
      summary: salesSummary,
      totals: totals[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});