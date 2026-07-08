import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from "../SupabaseClient";
import { Player } from "@lottiefiles/react-lottie-player";
import codeAnim from "../assets/enter-code.json";
import { 
  FaVideo, 
  FaSpinner, 
  FaCog, 
  FaShieldAlt, 
  FaGlobe, 
  FaHeadset, 
  FaArrowRight,
  FaLock,
  FaCheckCircle
} from 'react-icons/fa';
import "../ExamCode.css";
import Navbar from "../Components/common/Navbar";

function Examcode() {
    const [examCode, setExamCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const trimmedCode = examCode.trim();

        if (!trimmedCode || trimmedCode.length < 8) {
            setError("Please enter a valid exam code.");
            return;
        }

        setIsLoading(true);

        try {
            console.log('Fetching exam with code:', trimmedCode);
            const { data, error: fetchError } = await supabase
                .from('exams')
                .select('*')
                .eq('id', trimmedCode)
                .single();

            console.log('Exam fetch response:', { data, fetchError });
            setIsLoading(false);

            if (fetchError || !data) {
                console.log('Exam not found or error:', fetchError);
                setError("Exam code not found. Please double-check and try again.");
            } else if (!data.is_active) {
                console.log('Exam is not active, redirecting to blocked page');
                window.location.href = `/exam/${trimmedCode}/blocked`;
            } else {
                console.log('Exam is active, redirecting to diagnostics page');
                navigate(`/diagnostics/${trimmedCode}`);
            }
        } catch (err) {
            setIsLoading(false);
            setError("Something went wrong. Please try again later.");
        }
    };

    return (
        <div className="examcode-page">
            {/* Top Navigation Bar */}
            <Navbar />

            {/* Main Content Area */}
            <main className="diagnostics-content">
                <section className="welcome-header">
                    <h1>Ready for your Exam?</h1>
                    <p>
                        Enter your access code to proceed with the system diagnostics and proctoring setup.
                    </p>
                </section>

                <div className="diagnostics-dashboard">
                    {/* Left Column: Proctoring animation & Privacy Info */}
                    <div className="dashboard-left-col">
                        <div className="live-preview-card">
                            <div className="card-header">
                                <div className="header-title">
                                    <FaLock className="title-icon" />
                                    <span>PROCTORING GATEWAY</span>
                                </div>
                                <div className="recording-indicator green-indicator">
                                    <span className="indicator-dot green-dot"></span>
                                    <span>• ACTIVE</span>
                                </div>
                            </div>
                            
                            <div className="video-container-wrapper lottie-wrapper">
                                <Player 
                                    autoplay 
                                    loop 
                                    src={codeAnim} 
                                    style={{ height: '240px', width: '100%' }}
                                    className="proctoring-lottie"
                                />
                            </div>

                            <div className="card-footer">
                                <div className="device-info">
                                    <FaCog className="gear-icon" />
                                    <span>Secure Session Engine Active</span>
                                </div>
                            </div>
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

                    {/* Right Column: Code Entry Form & Live Support */}
                    <div className="dashboard-right-col">
                        <div className="hardware-diagnostic-card">
                            <div className="card-header-simple">
                                <h2>Enter Exam Code</h2>
                                <p className="card-subtitle">Verify your credentials and access permissions</p>
                            </div>

                            <form onSubmit={handleSubmit} className="examcode-form">
                                <div className="form-group">
                                    <label htmlFor="examCode">Exam Access Code</label>
                                    <input
                                        type="text"
                                        id="examCode"
                                        value={examCode}
                                        onChange={(e) => setExamCode(e.target.value)}
                                        className={`code-input ${error ? 'error-input' : ''}`}
                                        placeholder="e.g. 7b1f4e56-df7b..."
                                        required
                                    />
                                </div>
                                
                                {error && (
                                    <div className="error-callout">
                                        <FaTimesCircle className="error-callout-icon" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Instructions List styled as check items */}
                                <div className="diagnostic-checklist instruction-checklist">
                                    <div className="checklist-item status-passed">
                                        <div className="item-icon-wrapper">
                                            <FaCheckCircle className="check-success-icon" />
                                        </div>
                                        <div className="item-details">
                                            <div className="item-title">University Account</div>
                                            <p className="item-description">Ensure you are logged in using your verified student account.</p>
                                        </div>
                                    </div>

                                    <div className="checklist-item status-passed">
                                        <div className="item-icon-wrapper">
                                            <FaCheckCircle className="check-success-icon" />
                                        </div>
                                        <div className="item-details">
                                            <div className="item-title">Stable Connection</div>
                                            <p className="item-description">A stable internet speed of at least 1.0 Mbps is recommended.</p>
                                        </div>
                                    </div>

                                    <div className="checklist-item status-passed">
                                        <div className="item-icon-wrapper">
                                            <FaCheckCircle className="check-success-icon" />
                                        </div>
                                        <div className="item-details">
                                            <div className="item-title">Quiet Environment</div>
                                            <p className="item-description">Prepare a quiet and well-lit workspace ready for camera capture.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="diagnostic-action-container">
                                    <button 
                                        type="submit" 
                                        disabled={isLoading} 
                                        className="btn-proceed-exam active"
                                    >
                                        {isLoading ? (
                                            <>
                                                <FaSpinner className="spin mr-2" />
                                                Verifying Access Code...
                                            </>
                                        ) : (
                                            <>
                                                Start Exam
                                                <FaArrowRight className="btn-arrow-icon" />
                                            </>
                                        )}
                                    </button>
                                    <span className="action-hint">Verification takes just a few moments</span>
                                </div>
                            </form>
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
                            <button className="btn-livechat" type="button">Live Chat</button>
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

export default Examcode;
