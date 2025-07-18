import React from 'react';

const TestComponent = () => {
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '14px',
      fontFamily: 'monospace'
    }}>
      Test Component Rendered
    </div>
  );
};

export default TestComponent;
