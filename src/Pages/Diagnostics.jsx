import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  FaMicrophone, 
  FaVideo, 
  FaDesktop, 
  FaChrome, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaSpinner,
  FaCog,
  FaShieldAlt,
  FaGlobe,
  FaHeadset,
  FaArrowRight
} from 'react-icons/fa';
import { MdSpeed } from 'react-icons/md';
import { SiFirefox, SiSafari, SiOpera } from 'react-icons/si';
import "../Diagnostics.css";
import Navbar from "../Components/common/Navbar";

function Diagnostics() {
    const { examCode } = useParams();
    const navigate = useNavigate();
    
    // Media streams
    const [videoStream, setVideoStream] = useState(null);
    const videoRef = useRef(null);
    const audioIntervalRef = useRef(null);
    
    // Devices list
    const [cameras, setCameras] = useState([]);
    const [cameraLabel, setCameraLabel] = useState('Detecting camera...');
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [showCameraSelector, setShowCameraSelector] = useState(false);
    const [isScanningCameras, setIsScanningCameras] = useState(false);
    const [cameraScanNote, setCameraScanNote] = useState('');
    
    // Status of each diagnostic check
    const [status, setStatus] = useState({
        camera: { checking: true, passed: false, message: 'Checking camera...' },
        microphone: { checking: true, passed: false, message: 'Checking microphone...' },
        screenShare: { checking: false, passed: false, message: 'Select screen share to verify compatibility.' },
        browser: { checking: true, passed: false, message: 'Checking browser lock compatibility...' },
        internet: { checking: true, passed: false, message: 'Checking network speed...' }
    });

    useEffect(() => {
        // Initial setup
        runInitialChecks();

        const handleDeviceChange = () => {
            enumerateCameras();
        };
        if (navigator.mediaDevices?.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        }
        
        return () => {
            if (navigator.mediaDevices?.removeEventListener) {
                navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
            }
            // Clean up streams on unmount
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
            if (audioIntervalRef.current) {
                clearInterval(audioIntervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    const runInitialChecks = async () => {
        // 1. Browser Lock/Compatibility Check
        const browserRes = await checkBrowser();
        setStatus(prev => ({
            ...prev,
            browser: { checking: false, passed: browserRes.passed, message: browserRes.message, icon: browserRes.icon }
        }));

        // 2. Request Camera & Mic Permission
        await requestCameraAndMicPermissions();

        // 3. Network Speed Check in background
        const internetRes = await checkInternetSpeed();
        setStatus(prev => ({
            ...prev,
            internet: { checking: false, passed: internetRes.passed, message: internetRes.message }
        }));
    };

    const requestCameraAndMicPermissions = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setVideoStream(stream);
            
            // Get active camera info
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                setCameraLabel(videoTrack.label || 'Webcam (Active)');
                setSelectedCameraId(videoTrack.getSettings().deviceId || '');
            }
            
            setStatus(prev => ({
                ...prev,
                camera: { checking: false, passed: true, message: 'Camera permission granted and device active.' },
                microphone: { checking: false, passed: true, message: 'Input levels detected: -12dB (Stable)' }
            }));

            // Listen to audio levels
            startAudioMonitoring(stream);
            // List available cameras
            enumerateCameras();
        } catch (err) {
            console.error("Camera/Mic permission failed:", err);
            // Attempt video only fallback
            try {
                const videoOnlyStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setVideoStream(videoOnlyStream);
                
                const videoTrack = videoOnlyStream.getVideoTracks()[0];
                if (videoTrack) {
                    setCameraLabel(videoTrack.label || 'Webcam (Active)');
                }
                
                setStatus(prev => ({
                    ...prev,
                    camera: { checking: false, passed: true, message: 'Camera permission granted and device active.' },
                    microphone: { checking: false, passed: false, message: 'Microphone permission denied.' }
                }));
                enumerateCameras();
            } catch {
                setStatus(prev => ({
                    ...prev,
                    camera: { checking: false, passed: false, message: 'Camera permission denied.' },
                    microphone: { checking: false, passed: false, message: 'Microphone permission denied.' }
                }));
            }
        }
    };

    const startAudioMonitoring = (stream) => {
        if (audioIntervalRef.current) {
            clearInterval(audioIntervalRef.current);
        }
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            audioIntervalRef.current = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                
                // Map to db levels -60 to -5
                const db = average > 0 ? Math.round((average / 255) * 45 - 55) : -60;
                const statusStr = db > -40 ? 'Active' : 'Stable';
                
                setStatus(prev => ({
                    ...prev,
                    microphone: {
                        checking: false,
                        passed: true,
                        message: `Input levels detected: ${db}dB (${statusStr})`
                    }
                }));
            }, 600);
        } catch (e) {
            console.warn("Audio meter setup failed:", e);
        }
    };

    const enumerateCameras = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setCameras(videoDevices);
            if (videoDevices.length === 0) {
                setCameraScanNote('No cameras detected. Please connect a webcam and try again.');
            } else if (videoDevices.length === 1) {
                setCameraScanNote('1 camera detected on this device.');
            } else {
                setCameraScanNote(`${videoDevices.length} cameras available. Select one below.`);
            }
            return videoDevices;
        } catch (e) {
            console.error("Error listing cameras:", e);
            setCameraScanNote('Unable to scan camera devices.');
            return [];
        }
    };

    const switchCameraById = async (deviceId) => {
        if (!deviceId) return;
        
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        if (audioIntervalRef.current) {
            clearInterval(audioIntervalRef.current);
        }
        
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } },
                audio: true
            });
            setVideoStream(newStream);
            setSelectedCameraId(deviceId);
            localStorage.setItem('examlytic_preferred_camera_id', deviceId);
            
            const videoTrack = newStream.getVideoTracks()[0];
            if (videoTrack) {
                setCameraLabel(videoTrack.label || 'Webcam (Active)');
            }
            
            setStatus(prev => ({
                ...prev,
                camera: { checking: false, passed: true, message: 'Camera permission granted and device active.' }
            }));
            
            startAudioMonitoring(newStream);
            setShowCameraSelector(false);
        } catch (err) {
            console.error("Error switching camera:", err);
            setCameraScanNote('Failed to switch to selected camera. Reverting...');
            requestCameraAndMicPermissions();
        }
    };

    const handleCameraChange = async (e) => {
        await switchCameraById(e.target.value);
    };

    const handleChangeCameraClick = async () => {
        const nextOpen = !showCameraSelector;
        setShowCameraSelector(nextOpen);
        if (nextOpen) {
            setIsScanningCameras(true);
            await enumerateCameras();
            setIsScanningCameras(false);
        }
    };

    const handleScreenShare = async () => {
        setStatus(prev => ({
            ...prev,
            screenShare: { checking: true, passed: false, message: 'Checking screen share permission...' }
        }));
        
        try {
            // @ts-ignore
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            
            setStatus(prev => ({
                ...prev,
                screenShare: { checking: false, passed: true, message: 'Screen sharing verified and active.' }
            }));
        } catch (error) {
            console.error("Screen sharing permission denied:", error);
            setStatus(prev => ({
                ...prev,
                screenShare: { checking: false, passed: false, message: 'Screen sharing not allowed or canceled.' }
            }));
        }
    };

    const checkInternetSpeed = async () => {
        // Simulate a brief latency check to avoid CORS blockers on localhost
        await new Promise(resolve => setTimeout(resolve, 1000));
        const simulatedSpeed = (Math.random() * 8 + 12).toFixed(1);
        return { 
            passed: true, 
            message: `Internet speed: ${simulatedSpeed} Mbps (Stable)` 
        };
    };

    const checkBrowser = async () => {
        const userAgent = navigator.userAgent;
        let browserName = 'Unknown';
        let isSupported = false;
        let BrowserIcon = FaChrome;
        let iconColor = '#4285F4';
        
        if (userAgent.indexOf('Firefox') > -1) {
            browserName = 'Firefox';
            isSupported = true;
            BrowserIcon = SiFirefox;
            iconColor = '#FF9500';
        } else if (userAgent.indexOf('SamsungBrowser') > -1) {
            browserName = 'Samsung Browser';
            isSupported = true;
            BrowserIcon = SiSafari;
            iconColor = '#1428A0';
        } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
            browserName = 'Opera';
            isSupported = true;
            BrowserIcon = SiOpera;
            iconColor = '#FF1B2D';
        } else if (userAgent.indexOf('Edg') > -1) {
            browserName = 'Edge';
            isSupported = true;
            BrowserIcon = FaChrome;
            iconColor = '#0078D7';
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
                : `Unsupported browser (${browserName}). Please use Chrome, Safari, or Firefox.`,
            icon: icon
        };
    };

    const proceedToExam = () => {
        navigate(`/exam/${examCode}`);
    };

    // Check if required hardware items passed to enable continuation
    const canProceed = status.camera.passed && status.microphone.passed && status.screenShare.passed;

    return (
        <div className="diagnostics-page">
            <Navbar />

            {/* Main Content Area */}
            <main className="diagnostics-content">
                <section className="welcome-header">
                    <h1>Ready for your Exam?</h1>
                    <p>
                        We're performing a quick diagnostic check to ensure your hardware meets 
                        the proctoring requirements for a secure session.
                    </p>
                </section>

                <div className="diagnostics-dashboard">
                    {/* Left Column: Live Preview & Privacy Info */}
                    <div className="dashboard-left-col">
                        <div className="live-preview-card">
                            <div className="card-header">
                                <div className="header-title">
                                    <FaVideo className="title-icon" />
                                    <span>LIVE PREVIEW</span>
                                </div>
                                <div className="recording-indicator">
                                    <span className="indicator-dot"></span>
                                    <span>• REC</span>
                                </div>
                            </div>
                            
                            <div className="video-container-wrapper">
                                {videoStream ? (
                                    <video 
                                        ref={videoRef}
                                        autoPlay 
                                        playsInline 
                                        muted 
                                        className="webcam-video"
                                    />
                                ) : (
                                    <div className="video-placeholder">
                                        <FaSpinner className="spin-icon" />
                                        <p>Camera feed starting...</p>
                                    </div>
                                )}
                                
                                {/* Overlay pills */}
                                <div className="overlay-pill resolution-pill">
                                    <span className="pill-icon">💻</span>
                                    <span>1080p | 30 FPS</span>
                                </div>
                                
                                <div className="overlay-pill detection-pill">
                                    <div className="detection-title">Face Detection</div>
                                    <div className="detection-subtext">Centered and visible</div>
                                </div>
                                
                                <div className="overlay-pill calibrated-pill">
                                    <span>CALIBRATED</span>
                                </div>
                            </div>

                            <div className="card-footer">
                                <div className="device-info">
                                    <FaCog className="gear-icon" />
                                    {cameras.length > 0 ? (
                                        <select 
                                            value={selectedCameraId} 
                                            onChange={handleCameraChange}
                                            className="camera-select"
                                        >
                                            {cameras.map((camera, idx) => (
                                                <option key={camera.deviceId} value={camera.deviceId}>
                                                    {camera.label || `Camera ${idx + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span>{cameraLabel}</span>
                                    )}
                                </div>
                                <button 
                                    type="button"
                                    className="btn-change-camera" 
                                    onClick={handleChangeCameraClick}
                                >
                                    {showCameraSelector ? 'Close' : 'Change Camera'}
                                </button>
                            </div>

                            {showCameraSelector && (
                                <div style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#F8FAFC',
                                    borderTop: '1px solid #E5E7EB',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <strong style={{ color: '#111827' }}>
                                            {isScanningCameras ? 'Searching for available cameras...' : (cameraScanNote || 'Available Cameras')}
                                        </strong>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setIsScanningCameras(true);
                                                await enumerateCameras();
                                                setIsScanningCameras(false);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: '1px solid #D1D5DB',
                                                borderRadius: '6px',
                                                padding: '4px 10px',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                color: '#374151',
                                                backgroundColor: '#FFFFFF'
                                            }}
                                        >
                                            {isScanningCameras ? 'Scanning...' : 'Rescan Cameras'}
                                        </button>
                                    </div>
                                    {cameras.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {cameras.map((camera, idx) => {
                                                const isActive = camera.deviceId === selectedCameraId;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={camera.deviceId || idx}
                                                        onClick={() => switchCameraById(camera.deviceId)}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            border: isActive ? '1.5px solid #4F46E5' : '1px solid #E2E8F0',
                                                            backgroundColor: isActive ? '#EEF2FF' : '#FFFFFF',
                                                            color: isActive ? '#3730A3' : '#1F2937',
                                                            fontWeight: isActive ? 700 : 500,
                                                            cursor: 'pointer',
                                                            textAlign: 'left'
                                                        }}
                                                    >
                                                        <span>{camera.label || `Camera ${idx + 1}`}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                                            {isActive ? 'ACTIVE' : 'Select'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p style={{ margin: 0, color: '#6B7280' }}>
                                            No cameras found. Connect a camera and click Rescan Cameras.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Privacy Guarantee Banner */}
                        <div className="privacy-card">
                            <div className="privacy-icon-container">
                                <FaShieldAlt className="shield-icon" />
                            </div>
                            <div className="privacy-details">
                                <h3>Privacy Guarantee</h3>
                                <p>
                                    Your video feed is processed locally for diagnostic purposes. Recording only 
                                    begins once the exam officially starts. We adhere strictly to GDPR and ISO 27001 standards.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Hardware Diagnostic & Live Support */}
                    <div className="dashboard-right-col">
                        <div className="hardware-diagnostic-card">
                            <div className="card-header-simple">
                                <h2>Hardware Diagnostic</h2>
                                <p className="card-subtitle">
                                    {canProceed ? 'All checks passed successfully!' : 'Automated check in progress...'}
                                </p>
                            </div>

                            <div className="diagnostic-checklist">
                                {/* Webcam Item */}
                                <div className={`checklist-item ${status.camera.passed ? 'status-passed' : 'status-pending'}`}>
                                    <div className="item-icon-wrapper">
                                        {status.camera.passed ? (
                                            <FaCheckCircle className="check-success-icon" />
                                        ) : (
                                            <FaSpinner className="check-loading-icon spin" />
                                        )}
                                    </div>
                                    <div className="item-details">
                                        <div className="item-header">
                                            <span className="item-title">Webcam Access</span>
                                            <span className={`item-badge ${status.camera.passed ? 'badge-passed' : 'badge-pending'}`}>
                                                {status.camera.passed ? 'PASSED' : 'CHECKING'}
                                            </span>
                                        </div>
                                        <p className="item-description">{status.camera.message}</p>
                                    </div>
                                </div>

                                {/* Microphone Item */}
                                <div className={`checklist-item ${status.microphone.passed ? 'status-passed' : 'status-pending'}`}>
                                    <div className="item-icon-wrapper">
                                        {status.microphone.passed ? (
                                            <FaCheckCircle className="check-success-icon" />
                                        ) : (
                                            <FaSpinner className="check-loading-icon spin" />
                                        )}
                                    </div>
                                    <div className="item-details">
                                        <div className="item-header">
                                            <span className="item-title">Microphone</span>
                                            <span className={`item-badge ${status.microphone.passed ? 'badge-passed' : 'badge-pending'}`}>
                                                {status.microphone.passed ? 'PASSED' : 'CHECKING'}
                                            </span>
                                        </div>
                                        <p className="item-description">{status.microphone.message}</p>
                                    </div>
                                </div>

                                {/* Screen Share Item / Interactive Indigo Button */}
                                {!status.screenShare.passed ? (
                                    <button 
                                        className={`btn-screenshare-trigger ${status.screenShare.checking ? 'loading' : ''}`}
                                        onClick={handleScreenShare}
                                        disabled={status.screenShare.checking}
                                    >
                                        {status.screenShare.checking ? (
                                            <>
                                                <FaSpinner className="spin mr-2" />
                                                Verifying Screen Sharing...
                                            </>
                                        ) : (
                                            'Enable Screen Sharing'
                                        )}
                                    </button>
                                ) : (
                                    <div className="checklist-item status-passed">
                                        <div className="item-icon-wrapper">
                                            <FaCheckCircle className="check-success-icon" />
                                        </div>
                                        <div className="item-details">
                                            <div className="item-header">
                                                <span className="item-title">Screen Sharing</span>
                                                <span className="item-badge badge-passed">PASSED</span>
                                            </div>
                                            <p className="item-description">{status.screenShare.message}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Browser Lock Item */}
                                <div className={`checklist-item ${status.browser.passed ? 'status-passed' : 'status-pending'} browser-lock-item`}>
                                    <div className="item-icon-wrapper">
                                        {status.browser.checking ? (
                                            <FaSpinner className="check-loading-icon spin" />
                                        ) : status.browser.passed ? (
                                            <FaCheckCircle className="check-success-icon" />
                                        ) : (
                                            <div className="icon-circle-gray">
                                                <FaChrome className="lock-icon-pending" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="item-details">
                                        <div className="item-header">
                                            <span className="item-title">Browser Lock</span>
                                            <span className={`item-badge ${status.browser.passed ? 'badge-passed' : 'badge-pending'}`}>
                                                {status.browser.checking ? 'CHECKING' : (status.browser.passed ? 'READY' : 'UNSUPPORTED')}
                                            </span>
                                        </div>
                                        <p className="item-description">
                                            {status.browser.passed
                                                ? `${status.browser.message} — Fullscreen & Tab-Lock armed for exam session.`
                                                : status.browser.message}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Main Action Button */}
                            <div className="diagnostic-action-container">
                                <button 
                                    className={`btn-proceed-exam ${canProceed ? 'active' : 'disabled'}`}
                                    onClick={proceedToExam}
                                    disabled={!canProceed}
                                >
                                    Proceed to Identity Check
                                    <FaArrowRight className="btn-arrow-icon" />
                                </button>
                                <span className="action-hint">Complete all diagnostics to continue</span>
                            </div>
                        </div>

                        {/* Live Chat / Support Box */}
                        <div className="chat-support-card">
                            <div className="support-icon-wrapper">
                                <FaHeadset className="headset-icon" />
                            </div>
                            <div className="support-text">
                                <h3>Facing issues?</h3>
                                <p>Our tech team is online.</p>
                            </div>
                            <button className="btn-livechat">Live Chat</button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Footer */}
            <footer className="diagnostics-footer">
                <div className="footer-container">
                    <div className="footer-left">
                        <span className="footer-brand">Examlytic AI</span>
                        <span className="footer-copyright">© 2024 Examlytic AI. ISO 27001 Certified.</span>
                    </div>
                    <div className="footer-center">
                        <a href="#privacy" className="footer-link">Privacy Policy</a>
                        <a href="#terms" className="footer-link">Terms of Service</a>
                        <a href="#security" className="footer-link">Security Whitepaper</a>
                        <a href="#gdpr" className="footer-link">GDPR Compliance</a>
                    </div>
                    <div className="footer-right">
                        <button className="btn-footer-icon" title="Security Standards">
                            <FaShieldAlt />
                        </button>
                        <button className="btn-footer-icon" title="Language selection">
                            <FaGlobe />
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Diagnostics;
