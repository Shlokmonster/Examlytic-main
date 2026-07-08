import React from 'react';
import './Loader.css';

export default function Loader({ message = "Loading...", fullPage = false }) {
  return (
    <div className={`examlytic-loader-wrapper ${fullPage ? 'full-page' : ''}`}>
      <div className="loader-container">
        {/* Glowing Pulsing Outer Ring */}
        <div className="loader-glow-ring"></div>
        
        {/* Centered Rotating Double-Segment Arc */}
        <div className="loader-spinner-circle"></div>
        
        {/* Core Center Pulsing Dot */}
        <div className="loader-core-dot"></div>
      </div>
      
      {/* Loading Status Text */}
      {message && <p className="loader-status-message">{message}</p>}
    </div>
  );
}
