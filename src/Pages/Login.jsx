import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import supabase from "../SupabaseClient";
import Loader from "../Components/common/Loader";
import { useAuth } from "../hooks/useAuth";

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, role, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && user && role) {
            const redirectPath = location.state?.from?.pathname || (role === "admin" ? "/admin" : "/examcode");
            navigate(redirectPath, { replace: true });
        }
    }, [user, role, authLoading, location.state, navigate]);

    const handleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: window.location.origin,
                    queryParams: {
                        access_type: "offline",
                        prompt: "consent",
                        scope: "email profile",
                    },
                },
            });

            if (error) {
                console.error("Login error:", error);
                alert("Login failed. Please try again.");
            }
        } catch (err) {
            alert(`Login error: ${err.message}`);
        }
    };

    return (
        <div className="login-page">
            {/* Top Navigation Bar matching Diagnostics.jsx */}
            <header className="diagnostics-nav">
                <div className="nav-container">
                    <div className="brand-logo">
                        <span className="brand-passed">Examlytic</span>
                        <span className="brand-divider">|</span>
                        <span className="brand-subtext">SECURE PORTAL</span>
                    </div>
                </div>
            </header>

            <div className="cont1">
                {authLoading ? (
                    <Loader message="Checking session..." />
                ) : (
                    <>
                        <div className="login-card">
                            {/* ISO Badge */}
                            <div className="secure-badge">
                                <span className="secure-badge-check">✓</span> ISO 27001 Certified Secure
                            </div>

                            <h2>Secure Institutional Access</h2>

                            <p className="description">
                                Please authenticate using your university-managed workspace account to continue.
                            </p>

                            {/* Google Sign-in Button */}
                            <button className="google-signin-btn" onClick={handleLogin}>
                                <img
                                    src="https://cdn-icons-png.flaticon.com/128/300/300221.png"
                                    alt="Google Logo"
                                />
                                Continue with Google Workspace
                            </button>

                            {/* Encrypted Session Note */}
                            <div className="encrypted-note">
                                <span>🔒</span> End-to-end encrypted session
                            </div>
                        </div>

                        {/* Guardian note below the card */}
                        <div className="guardian-subtext">
                            Protected by Examlytic AI Guardian
                        </div>
                    </>
                )}
            </div>

            {/* Login Page Footer */}
            <footer className="login-footer">
                <div className="login-footer-left">
                    © 2026 Examlytic. Single Sign-On Security v2.4.0
                </div>
                <div className="login-footer-right">
                    <a href="#privacy">Privacy Shield</a>
                    <a href="#terms">Institutional Terms</a>
                    <a href="#support">Support</a>
                </div>
            </footer>
        </div>
    );
}

export default Login;
