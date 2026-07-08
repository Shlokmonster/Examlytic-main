import { useEffect, useState, useRef } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import supabase from "../SupabaseClient"
import Navbar from "../Components/common/Navbar"
import LiveMonitoring from "../Components/LiveMonitoring"
import Loader from "../Components/common/Loader"
import { toast } from "react-toastify"
import { 
  FaLock, FaUnlock, FaEye, FaTrash, FaLink, FaCopy, FaVideo, FaArrowLeft, 
  FaHistory, FaThLarge, FaList, FaUser, FaChartLine, FaCog, FaBook, FaPlus, 
  FaCheck, FaExclamationTriangle, FaTimes, FaQuestionCircle, FaPlay, FaEdit 
} from "react-icons/fa"
import "../AdminDashboard.css"

// Modal component for viewing/editing questions
const QuestionModal = ({ exam, onClose, onSave }) => {
  const [editedQuestions, setEditedQuestions] = useState([...exam.questions])
  const [isSaving, setIsSaving] = useState(false)
  
  // Create a new empty question
  const createNewQuestion = (type = 'mcq') => ({
    question: '',
    type: type,
    optionA: type === 'mcq' ? '' : undefined,
    optionB: type === 'mcq' ? '' : undefined,
    optionC: type === 'mcq' ? '' : undefined,
    optionD: type === 'mcq' ? '' : undefined,
    correct_answer: type === 'mcq' ? 'A' : ''
  })

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...editedQuestions]
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    }
    setEditedQuestions(updatedQuestions)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const { error } = await supabase
        .from('exams')
        .update({ questions: editedQuestions })
        .eq('id', exam.id)
      
      if (error) throw error
      onSave(editedQuestions)
      onClose()
      toast.success("Questions updated successfully");
    } catch (error) {
      console.error('Error updating questions:', error)
      toast.error('Failed to update questions. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!exam) return null

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white', padding: '24px', borderRadius: '12px',
        width: '90%', maxWidth: '650px', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>Edit Questions: {exam.title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9CA3AF' }}>&times;</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          {editedQuestions.map((q, index) => (
            <div key={index} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', position: 'relative', backgroundColor: '#F8FAFC' }}>
              {editedQuestions.length > 1 && (
                <button 
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}
                  onClick={() => setEditedQuestions(editedQuestions.filter((_, i) => i !== index))}
                  title="Delete question"
                >
                  <FaTrash size={14} />
                </button>
              )}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#4B5563', display: 'block', marginBottom: '6px' }}>Question {index + 1}</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    style={{
                      padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1.5px solid #E2E8F0', cursor: 'pointer',
                      backgroundColor: q.type === 'mcq' ? '#5850EC' : '#ffffff',
                      color: q.type === 'mcq' ? '#ffffff' : '#4B5563',
                      fontWeight: 600
                    }}
                    onClick={() => handleQuestionChange(index, 'type', 'mcq')}
                  >
                    MCQ
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1.5px solid #E2E8F0', cursor: 'pointer',
                      backgroundColor: q.type === 'answerable' ? '#5850EC' : '#ffffff',
                      color: q.type === 'answerable' ? '#ffffff' : '#4B5563',
                      fontWeight: 600
                    }}
                    onClick={() => handleQuestionChange(index, 'type', 'answerable')}
                  >
                    Short Answer
                  </button>
                </div>
                <input
                  type="text"
                  value={q.question || q.text || ''}
                  onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', outline: 'none' }}
                  placeholder="Enter the question text"
                />
              </div>

              {q.type === 'mcq' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  {['A', 'B', 'C', 'D'].map((letter) => (
                    <div key={letter}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Option {letter}</label>
                      <input
                        type="text"
                        value={q[`option${letter}`] || ''}
                        onChange={(e) => handleQuestionChange(index, `option${letter}`, e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: '6px', marginTop: '2px' }}
                      />
                    </div>
                  ))}
                  <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', marginRight: '8px' }}>Correct Option:</label>
                    <select
                      value={q.correct_answer || 'A'}
                      onChange={(e) => handleQuestionChange(index, 'correct_answer', e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    >
                      {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {q.type === 'answerable' && (
                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Correct Answer Guideline</label>
                  <input
                    type="text"
                    value={q.correct_answer || ''}
                    onChange={(e) => handleQuestionChange(index, 'correct_answer', e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', marginTop: '2px' }}
                    placeholder="Enter keywords or correct answer text"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
          <button 
            onClick={() => setEditedQuestions([...editedQuestions, createNewQuestion()])}
            style={{ padding: '8px 16px', backgroundColor: '#F3F4F6', color: '#1F2937', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            + Add Question
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={onClose} 
              style={{ padding: '8px 16px', backgroundColor: '#FFFFFF', color: '#4B5563', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              style={{ padding: '8px 16px', backgroundColor: '#5850EC', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { examId } = useParams();
  const navigate = useNavigate();

  // Redesigned states
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'exams', 'students', 'analytics', 'settings'
  const [exams, setExams] = useState([]);
  const [users, setUsers] = useState([]);
  const [userAttempts, setUserAttempts] = useState([]);
  const [activeAttempts, setActiveAttempts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  
  // Modals & Action States
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [currentExam, setCurrentExam] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [viewType, setViewType] = useState('grid'); // 'grid' or 'list'

  const [stats, setStats] = useState({
    activeExaminees: 0,
    completionRate: '0%',
    proctoringFlag: 'Low',
    proctoringAlerts: '0 Alerts',
    averageScore: '0'
  });

  const loadDashboardData = async () => {
    try {
      if (initialLoad) setLoading(true);
      setError(null);

      // 1. Fetch Exams
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .order("created_at", { ascending: false });
      if (examsError) throw examsError;

      const examsWithCounts = (examsData || []).map(exam => ({
        ...exam,
        questions: Array.isArray(exam.questions) ? exam.questions : [],
        questions_count: Array.isArray(exam.questions) ? exam.questions.length : 0
      }));
      setExams(examsWithCounts);

      // 2. Fetch Users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, user_name, user_avatar')
        .order('id');
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // 3. Fetch All Attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('exam_attempts')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (attemptsError) throw attemptsError;

      const attemptsWithUser = (attemptsData || []).map(attempt => {
        const userObj = (usersData || []).find(u => u.id === attempt.student_id);
        const examObj = examsWithCounts.find(e => e.id === attempt.exam_id);
        return {
          ...attempt,
          user_name: userObj?.user_name || userObj?.email?.split('@')[0] || 'Unknown Student',
          user_email: userObj?.email || 'N/A',
          user_avatar: userObj?.user_avatar,
          exam_title: examObj?.title || 'Exam',
          exam_subject: examObj?.subject || 'Midterm Assessment'
        };
      });
      setUserAttempts(attemptsWithUser);

      // 4. Split active vs completed attempts
      const active = attemptsWithUser.filter(a => a.submitted_at === null);
      const completed = attemptsWithUser.filter(a => a.submitted_at !== null);

      // 5. Fetch recent logs for active attempts to show proctoring flag
      let activeWithLogs = active.map(a => ({ ...a, flagsCount: 0, latestFlag: null }));
      if (active.length > 0) {
        const activeIds = active.map(a => a.id);
        const { data: logsData, error: logsError } = await supabase
          .from('exam_logs')
          .select('*')
          .in('exam_attempt_id', activeIds)
          .order('created_at', { ascending: false });

        if (!logsError && logsData) {
          activeWithLogs = active.map(a => {
            const studentLogs = logsData.filter(log => log.exam_attempt_id === a.id);
            const suspiciousLogs = studentLogs.filter(log => 
              ['TAB_SWITCH', 'FACE_NOT_FOUND', 'MULTIPLE_FACES', 'COCO_SSD_OBJECT'].includes(log.event_type)
            );
            return {
              ...a,
              flagsCount: suspiciousLogs.length,
              latestFlag: suspiciousLogs[0] || null,
              logs: studentLogs
            };
          });
        }
      }
      setActiveAttempts(activeWithLogs);

      // 6. Compute stats
      const totalCompleted = completed.length;
      const totalActive = active.length;
      const totalSessions = totalCompleted + totalActive;
      const completionRate = totalSessions > 0 
        ? ((totalCompleted / totalSessions) * 100).toFixed(1) 
        : "0.0";
      
      const avgScore = totalCompleted > 0 
        ? (completed.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0) / totalCompleted).toFixed(1)
        : "0.0";

      const totalAlerts = activeWithLogs.reduce((acc, curr) => acc + curr.flagsCount, 0);
      const proctoringFlag = totalAlerts > 5 ? 'High' : (totalAlerts > 0 ? 'Medium' : 'Low');

      setStats({
        activeExaminees: totalActive,
        completionRate: `${completionRate}%`,
        proctoringFlag,
        proctoringAlerts: `${totalAlerts} Alerts`,
        averageScore: avgScore
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Setup interval for live monitoring data update
    const interval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Sync route param with tab selection
  useEffect(() => {
    if (examId) {
      const matched = exams.find(e => e.id === examId);
      if (matched) {
        setSelectedExam(matched);
        setActiveTab('dashboard'); // keep on dashboard layout to show live monitor
      }
    }
  }, [examId, exams]);

  // Exam list action handlers
  const toggleExamStatus = async (examId, currentStatus) => {
    try {
      setLoadingStates(prev => ({ ...prev, [examId]: true }));
      
      const { error } = await supabase
        .from('exams')
        .update({ is_active: !currentStatus })
        .eq('id', examId);

      if (error) throw error;

      setExams(exams.map(exam => 
        exam.id === examId ? { ...exam, is_active: !currentStatus } : exam
      ));

      toast.success(`Exam ${!currentStatus ? 'unlocked' : 'locked'} successfully`);
    } catch (error) {
      console.error('Error toggling exam status:', error);
      toast.error(error.message || 'Failed to update exam status');
    } finally {
      setLoadingStates(prev => ({ ...prev, [examId]: false }));
    }
  };

  const handleViewExam = (exam) => {
    setSelectedExam(exam);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedExam(null);
  };

  const handleQuestionsUpdate = (updatedQuestions) => {
    setExams(prevExams => 
      prevExams.map(exam => 
        exam.id === selectedExam.id 
          ? { ...exam, questions: updatedQuestions, questions_count: updatedQuestions.length }
          : exam
      )
    );
  };

  const handleDeleteExam = async (id) => {
    if (window.confirm("Are you sure you want to delete this exam? This action cannot be undone.")) {
      try {
        const { error } = await supabase
          .from("exams")
          .delete()
          .eq("id", id);
        
        if (error) throw error;
        toast.success("Exam deleted successfully");
        loadDashboardData();
      } catch (err) {
        toast.error("Failed to delete exam.");
        console.error("Error deleting exam:", err);
      }
    }
  };

  // Share modal handlers
  const openShareModal = (exam) => {
    setCurrentExam(exam);
    setShareModalOpen(true);
  };

  const closeShareModal = () => {
    setShareModalOpen(false);
    setCurrentExam(null);
    setCopied(false);
  };

  const copyToClipboard = async (examId) => {
    try {
      const link = `${window.location.origin}/exam/${examId}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Exam link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast.error("Failed to copy link.");
    }
  };

  // Filter exams based on search query
  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (exam.subject && exam.subject.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filter students based on search query
  const filteredStudents = users.filter(user => 
    user.email.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
    (user.user_name && user.user_name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
  );

  if (initialLoad) {
    return <Loader fullPage message="Loading Admin Panel..." />;
  }

  return (
    <div className="admin-dashboard-layout">
      
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span className="brand-main">Examlytic Admin</span>
          <span className="brand-sub">UNIVERSITY PORTAL</span>
        </div>

        <nav className="sidebar-menu">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedUser(null); }}
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <FaThLarge /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('exams')}
            className={`sidebar-item ${activeTab === 'exams' ? 'active' : ''}`}
          >
            <FaBook /> Exams
          </button>
          <button 
            onClick={() => setActiveTab('students')}
            className={`sidebar-item ${activeTab === 'students' ? 'active' : ''}`}
          >
            <FaUser /> Students
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`sidebar-item ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            <FaChartLine /> Analytics
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <FaCog /> Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={() => navigate('/create-exam')} className="btn-new-exam-session">
            <FaPlus /> New Exam Session
          </button>
          <button className="sidebar-item" onClick={() => alert('Support portal is loading...')} style={{ fontSize: '0.85rem' }}>
            <FaQuestionCircle /> Support
          </button>
          <button className="sidebar-item" onClick={() => alert('Opening Documentation...')} style={{ fontSize: '0.85rem' }}>
            <FaHistory /> Documentation
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="admin-main-container">
        
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <h1>Overview</h1>
            {stats.activeExaminees > 0 && (
              <div className="live-session-badge">
                Live Session Active
              </div>
            )}
          </div>

          <div className="topbar-right">
            <div className="search-input-wrapper">
              <FaLink className="search-icon-svg" />
              <input 
                type="text" 
                placeholder="Search data points..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="topbar-btn" title="Notifications">
              <span style={{ fontSize: '1.3rem' }}>🔔</span>
              <span className="notification-dot"></span>
            </button>
            <img 
              src="https://cdn-icons-png.flaticon.com/128/1999/1999625.png" 
              alt="Admin Avatar" 
              className="user-avatar-img"
            />
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="admin-content">
          
          {error && (
            <div className="error-alert" style={{ marginBottom: '24px' }}>
              <strong>Error: </strong> {error}
            </div>
          )}

          {loading && !initialLoad && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B7280', fontWeight: 600 }}>Syncing live database...</span>
            </div>
          )}

          {/* Render Tab Views */}
          
          {/* TAB 1: DASHBOARD (Overview) */}
          {activeTab === 'dashboard' && (
            <>
              {/* Stats Grid */}
              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon-bg stat-icon-blue">
                      <FaUser />
                    </div>
                    <span className="stat-badge stat-badge-blue">+12%</span>
                  </div>
                  <span className="stat-label">Active Examinees</span>
                  <h3 className="stat-value">{stats.activeExaminees}</h3>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon-bg stat-icon-purple">
                      <FaHistory />
                    </div>
                    <span className="stat-badge stat-badge-purple">Avg. Time</span>
                  </div>
                  <span className="stat-label">Completion Rate</span>
                  <h3 className="stat-value">{stats.completionRate}</h3>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon-bg stat-icon-red">
                      <FaExclamationTriangle />
                    </div>
                    <span className="stat-badge stat-badge-red">{stats.proctoringAlerts}</span>
                  </div>
                  <span className="stat-label">Proctoring Flag</span>
                  <h3 className="stat-value" style={{ color: stats.proctoringFlag === 'High' ? '#EF4444' : (stats.proctoringFlag === 'Medium' ? '#F59E0B' : '#10B981') }}>
                    {stats.proctoringFlag}
                  </h3>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon-bg stat-icon-grey">
                      <FaChartLine />
                    </div>
                    <span className="stat-badge stat-badge-grey">Real-time</span>
                  </div>
                  <span className="stat-label">Average Score</span>
                  <h3 className="stat-value">{stats.averageScore}</h3>
                </div>
              </section>

              {/* Live Monitoring Panel */}
              <section className="live-monitoring-container">
                <div className="live-monitoring-header">
                  <h2>Live Monitoring <span className="live-indicator"><span className="live-indicator-dot"></span> Live</span></h2>
                  <div className="layout-toggle-buttons">
                    <button 
                      onClick={() => setViewType('grid')}
                      className={`layout-toggle-btn ${viewType === 'grid' ? 'active' : ''}`}
                    >
                      <FaThLarge />
                    </button>
                    <button 
                      onClick={() => setViewType('list')}
                      className={`layout-toggle-btn ${viewType === 'list' ? 'active' : ''}`}
                    >
                      <FaList />
                    </button>
                  </div>
                </div>

                {activeAttempts.length === 0 ? (
                  <div className="no-active-sessions">
                    <div className="no-active-sessions-icon">📹</div>
                    <h3>No Active Sessions</h3>
                    <p>There are no students currently writing exams right now.</p>
                  </div>
                ) : (
                  <div className="live-grid">
                    {activeAttempts.map(attempt => {
                      const isFlagged = attempt.flagsCount > 0;
                      let badgeClass = 'student-badge-match';
                      let badgeText = '99% Match';
                      let alertDetail = <span className="student-secured-detail">Secured & Active</span>;

                      if (isFlagged) {
                        badgeClass = 'student-badge-flagged';
                        badgeText = 'FLAGGED';
                        
                        const flagType = attempt.latestFlag?.event_type;
                        let reason = 'Behavior Alert';
                        if (flagType === 'TAB_SWITCH') reason = 'Tab Switched';
                        else if (flagType === 'FACE_NOT_FOUND') reason = 'Face Missing';
                        else if (flagType === 'MULTIPLE_FACES') reason = 'Multiple Faces';
                        
                        alertDetail = (
                          <span className="student-alert-detail">
                            <FaExclamationTriangle /> {reason}
                          </span>
                        );
                      }

                      return (
                        <div key={attempt.id} className={`student-card ${isFlagged ? 'flagged' : ''}`}>
                          <div className="student-card-image-container">
                            <div className={`student-card-badge ${badgeClass}`}>{badgeText}</div>
                            {/* Disconnected screen rendering or camera feeds */}
                            <div className="disconnected-placeholder">
                              <FaVideo />
                              <span>Live Proctor Feed</span>
                            </div>
                          </div>
                          
                          <div className="student-card-details">
                            <div className="student-name-row">
                              <span className={`student-status-dot ${isFlagged ? 'status-dot-flagged' : 'status-dot-active'}`}></span>
                              <span className="student-name-text" title={attempt.user_name}>{attempt.user_name}</span>
                            </div>
                            <div className="student-id-text">ID: {attempt.student_id.slice(0, 8).toUpperCase()}</div>
                            
                            <div className="student-card-footer">
                              {alertDetail}
                              <button 
                                onClick={() => navigate(`/monitor/${attempt.exam_id}`)}
                                className="btn-card-action" 
                                title="Open Live Feed & Logs"
                              >
                                <FaEye />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Recent Examinations Table */}
              <section className="recent-exams-card">
                <div className="table-header-band">
                  <h2>Recent Examinations</h2>
                  <button onClick={() => setActiveTab('exams')} className="btn-view-all">
                    View All <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                  </button>
                </div>

                <div className="dashboard-table-wrapper">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Exam Name</th>
                        <th>Subject/Department</th>
                        <th>Status</th>
                        <th>Candidates</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.slice(0, 5).map(exam => {
                        const candidatesCount = userAttempts.filter(a => a.exam_id === exam.id).length;
                        const isExamActive = exam.is_active;
                        
                        return (
                          <tr key={exam.id}>
                            <td>
                              <p className="table-exam-title">{exam.title}</p>
                              <span className="table-exam-subtitle">ID: {exam.id.slice(0, 8).toUpperCase()}</span>
                            </td>
                            <td>{exam.subject || 'General'}</td>
                            <td>
                              <span className={`table-status-badge ${isExamActive ? 'badge-status-active' : 'badge-status-completed'}`}>
                                {isExamActive ? 'Active' : 'Locked'}
                              </span>
                            </td>
                            <td>{candidatesCount}</td>
                            <td>
                              <button 
                                onClick={() => navigate(`/monitor/${exam.id}`)}
                                className="btn-table-action"
                                title="Monitor Exam"
                              >
                                <FaVideo />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* TAB 2: EXAMS (Management) */}
          {activeTab === 'exams' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontWeight: 800 }}>Manage Exams</h2>
                <button onClick={() => navigate('/create-exam')} className="btn-new-exam-session" style={{ margin: 0 }}>
                  <FaPlus /> Create New Exam
                </button>
              </div>

              {filteredExams.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
                  <p>No exams found matching your query.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {filteredExams.map(exam => {
                    const count = userAttempts.filter(a => a.exam_id === exam.id).length;
                    return (
                      <div key={exam.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', backgroundColor: '#FFFFFF', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{exam.title}</h3>
                          <span style={{ fontSize: '0.725rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: exam.is_active ? '#E6F4EA' : '#F1F5F9', color: exam.is_active ? '#047857' : '#475569' }}>
                            {exam.is_active ? 'Active' : 'Locked'}
                          </span>
                        </div>

                        <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#6B7280' }}><strong>Subject:</strong> {exam.subject || 'General'}</p>
                        <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#6B7280' }}><strong>Duration:</strong> {exam.duration_minutes} minutes</p>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#6B7280' }}><strong>Candidates:</strong> {count} attempts</p>

                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '12px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => handleViewExam(exam)}
                            style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#ffffff', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                            title="Edit Questions"
                          >
                            <FaEdit /> Edit
                          </button>
                          <button 
                            onClick={() => openShareModal(exam)}
                            style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#ffffff', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                          >
                            <FaLink /> Share
                          </button>
                          <button 
                            onClick={() => navigate(`/monitor/${exam.id}`)}
                            style={{ padding: '6px 12px', backgroundColor: '#5850EC', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                          >
                            <FaVideo /> Monitor
                          </button>
                          <button 
                            onClick={() => toggleExamStatus(exam.id, exam.is_active)}
                            disabled={loadingStates[exam.id]}
                            style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', backgroundColor: exam.is_active ? '#FFFBEB' : '#EFF6FF', color: exam.is_active ? '#D97706' : '#2563EB' }}
                          >
                            {exam.is_active ? <FaLock /> : <FaUnlock />}
                          </button>
                          <button 
                            onClick={() => handleDeleteExam(exam.id)}
                            style={{ padding: '6px 10px', backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STUDENTS & CLOUDINARY RECORDINGS GALLERY */}
          {activeTab === 'students' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 16px 0', fontWeight: 800 }}>Student Portal & Exam Recordings</h2>
                <div className="student-search-container">
                  <input 
                    type="text" 
                    placeholder="Search students by name or email..." 
                    className="student-search-input"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {filteredStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
                  <p>No students found matching your search.</p>
                </div>
              ) : (
                <div className="student-list-grid">
                  {filteredStudents.map(student => {
                    const attempts = userAttempts.filter(a => a.student_id === student.id && a.submitted_at !== null);
                    const hasRecordings = attempts.filter(a => a.recording_url).length;

                    return (
                      <div 
                        key={student.id} 
                        className="student-list-card"
                        onClick={() => {
                          setSelectedUser(student);
                          setSelectedAttempt(attempts[0] || null);
                        }}
                      >
                        <div className="student-list-avatar">
                          {student.user_name ? student.user_name.slice(0, 2).toUpperCase() : 'ST'}
                        </div>
                        <div className="student-list-info">
                          <span className="student-list-name">{student.user_name || student.email.split('@')[0]}</span>
                          <span className="student-list-email">{student.email}</span>
                        </div>
                        <div className="student-list-count" title="Attempts with videos">
                          {hasRecordings} / {attempts.length} Videos
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ANALYTICS (Overview Charts) */}
          {activeTab === 'analytics' && (
            <div>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontWeight: 800 }}>System Integrity Analytics</h2>
              </div>

              <div className="analytics-cards-grid">
                <div className="analytics-card">
                  <h3>Flag Breakdown</h3>
                  <div className="chart-container-placeholder">
                    <FaChartLine />
                    <span>Real-time Compliance Logs</span>
                  </div>
                  <table className="analytics-table" style={{ marginTop: '16px' }}>
                    <tbody>
                      <tr>
                        <td><span className="alert-type-badge">TAB_SWITCH</span> Tab Swapping</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {userAttempts.length > 0 ? 'Logged' : '0'}
                        </td>
                      </tr>
                      <tr>
                        <td><span className="alert-type-badge">FACE_NOT_FOUND</span> Face Out of Feed</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Active</td>
                      </tr>
                      <tr>
                        <td><span className="alert-type-badge">MULTIPLE_FACES</span> Co-Presence Detected</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Active</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="analytics-card">
                  <h3>Completion Metrics</h3>
                  <div className="chart-container-placeholder">
                    <FaHistory />
                    <span>Attempt Rates Overview</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#6B7280' }}>Total Attempts</p>
                      <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{userAttempts.length}</h4>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#6B7280' }}>Active Sessions</p>
                      <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#3B82F6' }}>{activeAttempts.length}</h4>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#6B7280' }}>Average Score</p>
                      <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{stats.averageScore}</h4>
                    </div>
                  </div>
                </div>

                <div className="analytics-card">
                  <h3>System Status</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <FaCheck style={{ color: '#16A34A' }} />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#16A34A' }}>Proctor Engine Status</h4>
                        <span style={{ fontSize: '0.75rem', color: '#15803D' }}>Operational & Secure</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <FaVideo style={{ color: '#2563EB' }} />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#2563EB' }}>LiveKit Streaming</h4>
                        <span style={{ fontSize: '0.75rem', color: '#1D4ED8' }}>Ready & Listening</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SETTINGS (General Configurations) */}
          {activeTab === 'settings' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h2 style={{ margin: '0 0 20px 0', fontWeight: 800 }}>Workspace Settings</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#4B5563', marginBottom: '6px' }}>Portal Name</label>
                  <input type="text" defaultValue="Examlytic Workspace" style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#4B5563', marginBottom: '6px' }}>Proctoring Alerts Cooldown (seconds)</label>
                  <input type="number" defaultValue="30" style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px', outline: 'none' }} />
                </div>
                <div>
                  <button 
                    onClick={() => toast.success("Settings saved successfully!")}
                    style={{ padding: '12px 24px', backgroundColor: '#5850EC', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Edit Questions Modal */}
      {isModalOpen && selectedExam && (
        <QuestionModal 
          exam={selectedExam} 
          onClose={handleCloseModal}
          onSave={handleQuestionsUpdate}
        />
      )}

      {/* Share Exam Modal */}
      {shareModalOpen && currentExam && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white', padding: '24px', borderRadius: '12px',
            width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Share Exam Link</h3>
              <button onClick={closeShareModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9CA3AF' }}>&times;</button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#4B5563' }}><strong>Exam:</strong> {currentExam.title}</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/exam/${currentExam.id}`}
                  style={{ flex: 1, padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', backgroundColor: '#F8FAFC' }}
                />
                <button
                  onClick={() => copyToClipboard(currentExam.id)}
                  style={{
                    padding: '10px 16px', backgroundColor: copied ? '#059669' : '#5850EC',
                    color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem'
                  }}
                >
                  <FaCopy /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Students will enter this code to start diagnostic tests.</span>
            </div>
          </div>
        </div>
      )}

      {/* Students Recordings Gallery Modal */}
      {selectedUser && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="recordings-detail-modal">
            <div className="recordings-modal-header">
              <div className="recordings-modal-title">
                <h3>{selectedUser.user_name || selectedUser.email.split('@')[0]}'s Exam Attempts</h3>
                <p>{selectedUser.email}</p>
              </div>
              <button 
                onClick={() => { setSelectedUser(null); setSelectedAttempt(null); }} 
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9CA3AF' }}
              >
                &times;
              </button>
            </div>
            
            <div className="recordings-modal-body">
              {/* Left attempts selection column */}
              <div className="attempts-list-col">
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: '4px' }}>ATTEMPTS WITH VIDEO</span>
                
                {userAttempts.filter(a => a.student_id === selectedUser.id && a.submitted_at !== null).length === 0 ? (
                  <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: '#6B7280' }}>No completed attempts found.</p>
                ) : (
                  userAttempts
                    .filter(a => a.student_id === selectedUser.id && a.submitted_at !== null)
                    .map(attempt => (
                      <div 
                        key={attempt.id} 
                        onClick={() => setSelectedAttempt(attempt)}
                        className={`attempt-selection-item ${selectedAttempt?.id === attempt.id ? 'selected' : ''}`}
                      >
                        <div className="attempt-item-title">{attempt.exam_title}</div>
                        <div className="attempt-item-date">{new Date(attempt.submitted_at).toLocaleString()}</div>
                        <div className="attempt-item-meta">
                          <span className={Number(attempt.score) >= 50 ? 'meta-score-pass' : 'meta-score-fail'}>
                            Score: {Number(attempt.score).toFixed(1)}%
                          </span>
                          {attempt.recording_url && (
                            <span className="meta-duration" style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FaPlay size={10} /> Video Ready
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Right player preview column */}
              <div className="video-player-col">
                {selectedAttempt ? (
                  <>
                    <div className="video-player-container">
                      {selectedAttempt.recording_url ? (
                        <video 
                          key={selectedAttempt.id}
                          controls 
                          className="embedded-video-element"
                          src={selectedAttempt.recording_url}
                        />
                      ) : (
                        <div className="no-video-placeholder">
                          <FaHistory />
                          <span>No video recording was uploaded for this attempt.</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="video-details-box">
                      <h4>Attempt Verification Details</h4>
                      <p><strong>Attempt ID:</strong> {selectedAttempt.id.slice(0, 8).toUpperCase()}</p>
                      <p><strong>Subject:</strong> {selectedAttempt.exam_subject}</p>
                      <p><strong>Submitted At:</strong> {new Date(selectedAttempt.submitted_at).toLocaleString()}</p>
                      {selectedAttempt.recording_url && (
                        <a 
                          href={selectedAttempt.recording_url} 
                          target="_blank" 
                          rel="noreferrer"
                        >
                          Open raw recording in new tab &rarr;
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="video-player-container" style={{ backgroundColor: '#F8FAFC', border: '1.5px dashed #E2E8F0' }}>
                    <div className="no-video-placeholder">
                      <FaPlay />
                      <span>Select an attempt to play screen recording logs</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
