import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from "../SupabaseClient";
import Navbar from "../Components/common/Navbar";
import { Player } from "@lottiefiles/react-lottie-player";
import codeAnim from "../assets/enter-code.json";
import loadingAnim from "../assets/loading.json"; // 🔄 Lottie for loading
import "../ExamCode.css";

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
                // Use window.location for more reliable navigation
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
            <Navbar />
            <div className="examcode-wrapper">
                <div className="examcode-card">
                    <div className="examcode-left">
                        <Player autoplay loop src={codeAnim} style={{ height: "400px", width: "400px" }} />
                    </div>

                    <div className="examcode-right">
                        <h1 className="examcode-title">Enter Exam Code</h1>
                        <p className="examcode-instruction">
                            To begin, enter the exam code shared by your instructor. Make sure:
                        </p>
                        <ul className="examcode-list">
                            <li>You're using your university account</li>
                            <li>You have stable internet connection</li>
                            <li>You’re in a quiet environment ready for proctoring</li>
                        </ul>
                        <form onSubmit={handleSubmit} className="examcode-form">
                            <label htmlFor="examCode">Exam Code</label>
                            <input
                                type="text"
                                id="examCode"
                                value={examCode}
                                onChange={(e) => setExamCode(e.target.value)}
                                className={error ? 'error-input' : ''}
                                placeholder="e.g. 7b1f4e56-df7b..."
                                required
                            />
                            {error && <p className="error-text">{error}</p>}

                            <button type="submit" disabled={isLoading} className="submit-btn">
                                {isLoading ? (
                                    <div className="loading-box">
                                        <Player autoplay loop src={loadingAnim} style={{ height: 28, width: 28 }} />
                                        <span className="loading-text">Verifying...</span>
                                    </div>
                                ) : (
                                    "Start Exam"
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Examcode;
