import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import supabase from '../../SupabaseClient';

const Navbar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error.message);
    }
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <header className="diagnostics-nav">
      <div className="nav-container">
        <div className="brand-logo">
          <span className="brand-passed">Examlytic</span>
          <span className="brand-divider">|</span>
          <span className="brand-subtext">PROCTORED WORKSPACE</span>
        </div>
        <div className="nav-controls">
          <div className="avatar-container" ref={dropdownRef}>
            <div className="avtar-wrapper" onClick={toggleDropdown}>
              <img 
                src="https://cdn-icons-png.flaticon.com/128/1999/1999625.png" 
                alt="User Avatar"  
                className="avtar-img"
              />
            </div>
            {isDropdownOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item logout-btn" onClick={handleLogout} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .diagnostics-nav {
          background-color: #ffffff;
          border-bottom: 1px solid #E5E7EB;
          padding: 0.85rem 2rem;
          position: sticky;
          top: 0;
          z-index: 1000;
          width: 100%;
        }
        .nav-container {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .brand-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 1.15rem;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .brand-passed {
          color: #059669;
          letter-spacing: 0.05em;
        }
        .brand-divider {
          color: #D1D5DB;
          font-weight: 300;
        }
        .brand-subtext {
          font-size: 0.75rem;
          font-weight: 600;
          color: #4B5563;
          letter-spacing: 0.1em;
        }
        .nav-controls {
          display: flex;
          align-items: center;
        }
        .avatar-container {
          position: relative;
          display: inline-block;
          cursor: pointer;
        }
        .avtar-wrapper {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 2px solid #059669;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .avtar-wrapper:hover {
          transform: scale(1.05);
        }
        .avtar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .dropdown-menu {
          position: absolute;
          right: 0;
          top: 100%;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          min-width: 140px;
          z-index: 1001;
          margin-top: 8px;
          border: 1px solid rgba(0, 0, 0, 0.05);
          animation: navFadeIn 0.2s ease-in-out;
          overflow: hidden;
        }
        .dropdown-item {
          padding: 12px 18px;
          color: #1f2937;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        .dropdown-item:hover {
          background-color: #fee2e2;
          color: #dc2626;
        }
        @keyframes navFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
};

export default Navbar;