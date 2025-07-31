import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  FaMicrophone, 
  FaVideo, 
  FaDesktop, 
  FaChrome, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaSpinner 
} from 'react-icons/fa';
import { MdSpeed } from 'react-icons/md';
import { SiFirefox, SiSafari, SiOpera } from 'react-icons/si';
import "../Diagnostics.css";

function Diagnostics() {
    const { examCode } = useParams();
    const navigate = useNavigate();
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState({
        microphone: { checking: true, passed: false, message: 'Checking microphone...' },
        camera: { checking: true, passed: false, message: 'Checking camera...' },
        screenShare: { checking: true, passed: false, message: 'Checking screen sharing...' },
        internet: { checking: true, passed: false, message: 'Checking internet speed...' },
        browser: { checking: true, passed: false, message: 'Checking browser compatibility...' }
    });

    useEffect(() => {
        runDiagnostics();
    }, []);

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const checkMicrophone = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return { passed: true, message: 'Microphone access granted' };
        } catch (error) {
            return { passed: false, message: 'Microphone access denied' };
        }
    };

    const checkCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            return { passed: true, message: 'Camera access granted' };
        } catch (error) {
            return { passed: false, message: 'Camera access denied' };
        }
    };

    const checkScreenShare = async () => {
        try {
            // @ts-ignore - TypeScript doesn't know about getDisplayMedia
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            return { passed: true, message: 'Screen sharing available' };
        } catch (error) {
            return { passed: false, message: 'Screen sharing not available' };
        }
    };

    const checkInternetSpeed = async () => {
        try {
            const startTime = performance.now();
            const response = await fetch('https://httpbin.org/bytes/1000000');
            await response.arrayBuffer();
            const endTime = performance.now();
            const speed = (8000000 / (endTime - startTime)).toFixed(2); // 1MB in bits / time
            const passed = parseFloat(speed) > 1000; // 1Mbps minimum
            return { 
                passed, 
                message: `Internet speed: ${(speed / 1000).toFixed(2)} Mbps` 
            };
        } catch (error) {
            return { passed: false, message: 'Failed to check internet speed' };
        }
    };

    const checkBrowser = async () => {
        const userAgent = navigator.userAgent;
        let browserName = 'Unknown';
        let isSupported = false;
        let BrowserIcon = FaChrome; // Default icon component
        let iconColor = '#4285F4'; // Default Chrome blue
        
        // Detect browser and set properties
        if (userAgent.indexOf('Firefox') > -1) {
            browserName = 'Firefox';
            isSupported = true;
            BrowserIcon = SiFirefox;
            iconColor = '#FF9500';
        } else if (userAgent.indexOf('SamsungBrowser') > -1) {
            browserName = 'Samsung Browser';
            isSupported = true;
            BrowserIcon = SiSafari; // Using Safari icon as fallback
            iconColor = '#1428A0';
        } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
            browserName = 'Opera';
            isSupported = true;
            BrowserIcon = SiOpera;
            iconColor = '#FF1B2D';
        } else if (userAgent.indexOf('Trident') > -1) {
            browserName = 'Internet Explorer';
            isSupported = false;
            iconColor = '#0076D7';
        } else if (userAgent.indexOf('Edg') > -1) {
            browserName = 'Edge';
            isSupported = true;
            // Using Chrome icon as fallback for Edge
            BrowserIcon = FaChrome;
            iconColor = '#0078D7';
        } else if (userAgent.indexOf('Brave') > -1 || (navigator.brave && await navigator.brave.isBrave())) {
            browserName = 'Brave';
            isSupported = true;
            BrowserIcon = FaChrome; // Using Chrome icon as fallback for Brave
            iconColor = '#FB542B'; // Brave's brand color
        } else if (userAgent.indexOf('Chrome') > -1) {
            browserName = 'Chrome';
            isSupported = true;
            BrowserIcon = FaChrome;
            iconColor = '#4285F4';
        } else if (userAgent.indexOf('Safari') > -1) {
            browserName = 'Safari';
            isSupported = true;
            BrowserIcon = SiSafari;
            iconColor = '#000000';
        }
        
        const icon = <BrowserIcon className="check-type-icon" style={{ color: iconColor }} />;
        
        return {
            passed: isSupported,
            message: isSupported 
                ? `Using ${browserName}`
                : `Unsupported browser (${browserName}). Please use Chrome, Firefox, Edge, Opera, or Safari.`,
            icon: icon
        };
    };

    const runDiagnostics = async () => {
        // First, set up the browser check with icon
        const browserCheck = checkBrowser();
        
        const checks = [
            { key: 'microphone', fn: checkMicrophone },
            { key: 'camera', fn: checkCamera },
            { key: 'screenShare', fn: checkScreenShare },
            { key: 'internet', fn: checkInternetSpeed },
            { 
                key: 'browser', 
                fn: () => Promise.resolve(browserCheck),
                icon: browserCheck.icon
            }
        ];

        for (let i = 0; i < checks.length; i++) {
            const { key, fn } = checks[i];
            setProgress(((i + 1) / checks.length) * 100);
            
            setStatus(prev => ({
                ...prev,
                [key]: { 
                    ...prev[key], 
                    checking: true, 
                    message: `Checking ${key}...`,
                    icon: checks[i].icon || null
                }
            }));

            try {
                const result = await fn();
                await delay(800); // Slightly reduced delay for better UX
                
                setStatus(prev => ({
                    ...prev,
                    [key]: { 
                        ...result, 
                        checking: false,
                        message: result.message,
                        icon: result.icon || prev[key].icon || null
                    }
                }));
            } catch (error) {
                console.error(`Error in ${key} check:`, error);
                setStatus(prev => ({
                    ...prev,
                    [key]: { 
                        passed: false, 
                        checking: false, 
                        message: `Error checking ${key}`,
                        icon: prev[key].icon || null
                    }
                }));
            }
        }

        // After all checks, wait a moment and then navigate
        setTimeout(() => {
            navigate(`/exam/${examCode}`);
        }, 1000);
    };

    const allPassed = Object.values(status).every(check => !check.checking && check.passed);

    return (
        <div className="diagnostics-container">
            <h1>System Diagnostics</h1>
            <p className="subtitle">Please wait while we check your system requirements</p>
            
            <div className="progress-bar">
                <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            
            <div className="checks-container">
                {Object.entries(status).map(([key, check]) => {
                    let icon;
                    let title = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                    
                    // Set appropriate icon based on check type if not already set
                    if (!check.icon) {
                        switch(key) {
                            case 'microphone':
                                icon = <FaMicrophone className="check-type-icon" style={{ color: '#4A90E2' }} />;
                                break;
                            case 'camera':
                                icon = <FaVideo className="check-type-icon" style={{ color: '#E74C3C' }} />;
                                break;
                            case 'screenShare':
                                icon = <FaDesktop className="check-type-icon" style={{ color: '#9B59B6' }} />;
                                break;
                            case 'internet':
                                icon = <MdSpeed className="check-type-icon" style={{ color: '#2ECC71' }} />;
                                break;
                            case 'browser':
                                // Browser icon is set in checkBrowser function
                                break;
                            default:
                                icon = null;
                        }
                    }
                    
                    return (
                        <div key={key} className={`check-item ${check.checking ? 'checking' : check.passed ? 'passed' : 'failed'}`}>
                            <div className="check-icon">
                                {check.checking ? (
                                    <FaSpinner className="fa-spin" />
                                ) : check.passed ? (
                                    <FaCheckCircle className="check-success" />
                                ) : (
                                    <FaTimesCircle className="check-failed" />
                                )}
                            </div>
                            <div className="check-details">
                                <div className="check-title">
                                    {check.icon || icon}
                                    {title}
                                </div>
                                <div className="check-message">{check.message}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {progress === 100 && (
                <div className="diagnostics-result">
                    {allPassed ? (
                        <div className="success-message">
                            All checks passed! Redirecting to exam...
                        </div>
                    ) : (
                        <div className="warning-message">
                            Some checks failed. You may experience issues during the exam.
                            <button 
                                onClick={() => navigate(`/exam/${examCode}`)}
                                className="continue-button"
                            >
                                Continue Anyway
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Diagnostics;
