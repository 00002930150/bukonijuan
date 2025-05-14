import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import ProductMenu from './components/ProductMenu';
import Home from './components/Home';
import ChatBot from './components/ChatBot';
import LoginSignup from './components/LoginSignup';
import AdminDashboard from './components/AdminDashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import SalesReport from './components/SalesReport';
import About from './components/About';
import Contact from './components/ContactUs';
import Gallery from './components/Gallery';
import HomeAfterLogin from './components/HomeAfterLogin';
import Delivery from './components/Delivery';
import axios from 'axios';

// API configuration
axios.defaults.baseURL = 'http://localhost/buko-ni-juan-api';
axios.defaults.headers.post['Content-Type'] = 'application/json';
axios.defaults.headers.put['Content-Type'] = 'application/json';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDevelopersModal, setShowDevelopersModal] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false); // New state for logout confirmation
  const [showChatbot, setShowChatbot] = useState(false);
  const [apiStatus, setApiStatus] = useState({ checked: false, connected: false });

  // Check API connection on app start
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        const response = await axios.get('/');
        console.log('API Connection Test:', response.data);
        setApiStatus({ checked: true, connected: true });
      } catch (error) {
        console.error('API Connection Failed:', error);
        setApiStatus({ checked: true, connected: false });
        
        // Try fallback
        try {
          const fallbackResponse = await axios.get('/test.php');
          console.log('API Fallback Test:', fallbackResponse.data);
          setApiStatus({ checked: true, connected: true });
        } catch (fallbackError) {
          console.error('API Fallback Connection Failed:', fallbackError);
        }
      }
    };
    
    checkApiConnection();
  }, []);

  // Check for saved login
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('bukoUser'));
    if (user && user.id) {
      setIsLoggedIn(true);
      setCurrentUser(user);
      setUserRole(user.role);
    }
  }, []);

  const handleLogin = async (credentials) => {
    console.log('Login attempt with:', credentials);
    
    // Handle hardcoded credentials
    if (credentials.username === 'admin' && credentials.password === 'admin123') {
      console.log('Admin login successful');
      const userData = {
        id: 1,
        username: 'admin',
        role: 'admin',
        full_name: 'Administrator'
      };
      
      setIsLoggedIn(true);
      setCurrentUser(userData);
      setUserRole(userData.role);
      localStorage.setItem('bukoUser', JSON.stringify(userData));
      setShowLoginModal(false);
      
      return { success: true };
    } 
    
    if (credentials.username === 'employee' && credentials.password === 'employee123') {
      console.log('Employee login successful');
      const userData = {
        id: 2,
        username: 'employee',
        role: 'employee',
        full_name: 'Regular Employee'
      };
      
      setIsLoggedIn(true);
      setCurrentUser(userData);
      setUserRole(userData.role);
      localStorage.setItem('bukoUser', JSON.stringify(userData));
      setShowLoginModal(false);
      
      return { success: true };
    }
    
    // Try API login
    try {
      const response = await axios.post('/users/login', credentials);
      const userData = response.data.user;
      
      setIsLoggedIn(true);
      setCurrentUser(userData);
      setUserRole(userData.role);
      localStorage.setItem('bukoUser', JSON.stringify(userData));
      setShowLoginModal(false);
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error.response?.data?.error || error.message);
      return { 
        success: false, 
        message: error.response?.data?.error || 'Login failed. Please check your credentials.' 
      };
    }
  };

  // Updated to show confirmation modal instead of logging out immediately
  const handleLogoutButton = () => {
    setShowLogoutConfirmation(true);
  };

  // This function handles the actual logout after confirmation
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUserRole('');
    localStorage.removeItem('bukoUser');
    setShowLogoutConfirmation(false);
  };

  // Function to cancel logout
  const cancelLogout = () => {
    setShowLogoutConfirmation(false);
  };

  const toggleLoginModal = () => {
    setShowLoginModal(!showLoginModal);
  };

  const toggleDevelopersModal = () => {
    setShowDevelopersModal(!showDevelopersModal);
  };

  const toggleChatbot = () => {
    setShowChatbot(!showChatbot);
  };

  // Developers data
  const developers = [
    "AUSTRIA, FIONNA YVONNE",
    "ARNESTO, CHRYSTAL JEWELLE",
    "BANAAG, KARTT IVAN",
    "CABANSAG, MIKYLLA ANNIKA",
    "MAGPANTAY, RIZELLE CARLA",
    "MORALES, ADRIAN KYLE",
    "PERALTA, PRECIOUS LARA",
    "REMINAL, GRACE",
    "ZAPATA, CEDRIC"
  ];

  return (
    <Router>
      <div className="app">
        {apiStatus.checked && !apiStatus.connected && (
          <div className="api-warning">
            API connection issue detected. Please check your server configuration.
          </div>
        )}
        
        <Header 
          isLoggedIn={isLoggedIn} 
          currentUser={currentUser} 
          userRole={userRole}
          onLogout={handleLogoutButton} // Changed to use the new function
          toggleLoginModal={toggleLoginModal}
          toggleDevelopersModal={toggleDevelopersModal}
        />

        <Routes>
          <Route path="/" element={isLoggedIn ? <HomeAfterLogin currentUser={currentUser} /> : <Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/products" element={<ProductMenu />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/" element={isLoggedIn ? <HomeAfterLogin currentUser={currentUser} /> : <Home />} />
          
          <Route 
            path="/admin" 
            element={isLoggedIn ? <AdminDashboard userRole={userRole} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/pos" 
            element={isLoggedIn ? <POS currentUser={currentUser} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/inventory" 
            element={isLoggedIn ? <Inventory userRole={userRole} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/sales" 
            element={isLoggedIn ? <SalesReport userRole={userRole} /> : <Navigate to="/" />} 
          />
        </Routes>

        <Footer />

        {/* Login Modal */}
        {showLoginModal && (
          <div className="modal-overlay" onClick={toggleLoginModal}>
            <div className="login-modal" onClick={(e) => e.stopPropagation()}>
              <button className="close-modal login-close" onClick={toggleLoginModal}>×</button>
              <LoginSignup onLogin={handleLogin} />
            </div>
          </div>
        )}
        
        {/* Developers Modal */}
        {showDevelopersModal && (
          <div className="modal-overlay" onClick={toggleDevelopersModal}>
            <div 
              className="developers-modal" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>ABOUT THE DEVELOPERS</h2>
              </div>
              <div className="developers-list">
                <ul>
                  {developers.map((dev, index) => (
                    <li key={index}>• {dev}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirmation && (
          <div className="modal-overlay">
            <div className="logout-confirmation-modal">
              <button className="close-button" onClick={cancelLogout}>×</button>
              <h2>Are you sure you want to log out?</h2>
              <div className="logout-buttons">
                <button className="yes-button" onClick={handleLogout}>Yes</button>
                <button className="cancel-button" onClick={cancelLogout}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Chatbot */}
        {!isLoggedIn && (
          <>
            <div className="chat-icon" onClick={toggleChatbot}>
              <span>💬</span>
            </div>
            {showChatbot && <ChatBot onClose={toggleChatbot} />}
          </>
        )}
      </div>
    </Router>
  );
}

export default App;