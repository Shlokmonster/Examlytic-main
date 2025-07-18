import React from 'react';
import { useNavigate } from 'react-router-dom';
import apHero from '../assets/ap-hero.svg';

const AutoProctorLanding = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '64px'
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '30px', fontWeight: '600', color: '#1f2937' }}>Examlytic</span>
          </div>
          
          {/* Navigation */}
          <nav style={{ display: 'flex', gap: '32px' }}>
            <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>How to Use</a>
            <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>API Integration</a>
            <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>Pricing</a>
            <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>Customers</a>
            <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>FAQs</a>
            <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>Help</a>
          </nav>
          
          {/* Login Button */}
          <button
            style={{
              backgroundColor: '#1f2937',
              color: 'white',
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '17px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '80px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '80px'
      }}>
        {/* Left Section */}
        <div style={{ flex: '1' }}>
          {/* Rating Section */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '32px',
            gap: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '18px' }}>📊</span>
              <span style={{ 
                color: '#3b82f6', 
                fontSize: '16px',
                fontWeight: '500'
              }}>38 Million+ Installs</span>
              <span style={{ fontSize: '14px', color: '#3b82f6' }}>↗</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '500' }}>4.5/5</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                {[...Array(4)].map((_, i) => (
                  <span key={i} style={{ color: '#fbbf24', fontSize: '16px' }}>★</span>
                ))}
                <span style={{ color: '#fbbf24', fontSize: '16px' }}>☆</span>
              </div>
              <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
            </div>
          </div>

          {/* Main Heading */}
          <h1 style={{
            fontSize: '56px',
            fontWeight: '700',
            color: '#1f2937',
            lineHeight: '1.1',
            marginBottom: '24px',
            fontFamily: 'Georgia, serif'
          }}>
            Automated Proctoring to<br />
            Prevent Exam Cheating
          </h1>

          {/* Description */}
          <p style={{
            fontSize: '18px',
            color: '#6b7280',
            lineHeight: '1.6',
            marginBottom: '40px',
            maxWidth: '480px'
          }}>
            Our AI tracks candidate activity remotely. So, no more cheating on online tests.
          </p>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '16px',
            marginBottom: '16px'
          }}>

            <button style={{
              backgroundColor: '#064e3b',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              Conduct An Exam
            </button>
          </div>
        </div>
        {/* Illustration */}
        <div style={{ flex: '1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img src={apHero} alt="Automated Proctoring Illustration" style={{ maxWidth: '100%', height: 'auto', maxHeight: '420px' }} />
        </div>
      </main>

      {/* Section Heading */}
      <h1 style={{
        fontSize: '56px',
        fontWeight: '700',
        color: '#1f2937',
        lineHeight: '1.1',
        marginBottom: '24px',
        fontFamily: 'Georgia, serif',
        textAlign: 'center',
      }}>
        Why Choose Examlytics?
      </h1>
      {/* Comparison Table Section */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '80px 24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '1200px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            background: '#ffffff',
            borderBottom: '2px solid #f0f0f0',
            padding: '20px 25px',
            alignItems: 'center',
          }}>
            <div></div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#16a34a', letterSpacing: '-0.5px' }}>Examlytics</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ color: '#9ca3af', fontSize: '18px', fontWeight: '500', lineHeight: '1.4' }}>Other proctoring<br />software</span>
            </div>
          </div>
          <div style={{ background: 'white' }}>
            {[
              { name: "Restrictive exam with device lockdown", smowl: true, other: true },
              { name: "Dual camera and human supervision", smowl: true, other: false },
              { name: "No need to install applications", smowl: true, other: false },
              { name: "Low internet consumption by capturing images instead of video", smowl: true, other: false },
              { name: "Fully integrated solution in your LMS educational platform", smowl: true, other: false },
              { name: "Customizable for any type of assessment: in-person and/or online", smowl: true, other: false },
              { name: "European company compliant with GDPR", smowl: true, other: false },
              { name: "Flexible licensing model (per exam/per user)", smowl: true, other: false },
            ].map((feature, index) => (
              <div key={index} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                padding: '15px 25px',
                borderBottom: '1px solid #f0f0f0',
                alignItems: 'center',
              }}>
                <div style={{ color: '#374151', fontSize: '18px', fontWeight: '400', lineHeight: '1.5', paddingRight: '15px' }}>{feature.name}</div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {feature.smowl ? (
                    <span style={{ color: '#16a34a', fontSize: '22px', fontWeight: 'bold' }}>✓</span>
                  ) : (
                    <span style={{ color: '#ef4444', fontSize: '22px', fontWeight: 'bold' }}>✗</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {feature.other ? (
                    <span style={{ color: '#16a34a', fontSize: '22px', fontWeight: 'bold' }}>✓</span>
                  ) : (
                    <span style={{ color: '#ef4444', fontSize: '22px', fontWeight: 'bold' }}>✗</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};



const Homepage = AutoProctorLanding;
export default Homepage;