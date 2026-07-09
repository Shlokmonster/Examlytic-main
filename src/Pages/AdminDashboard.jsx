import { useEffect, useState, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import supabase from "../SupabaseClient"
import Loader from "../Components/common/Loader"
import { toast } from "react-toastify"
import { 
  FaLock, FaUnlock, FaEye, FaTrash, FaLink, FaCopy, FaVideo, FaArrowLeft, 
  FaHistory, FaThLarge, FaList, FaUser, FaChartLine, FaCog, FaBook, FaPlus, 
  FaCheck, FaExclamationTriangle, FaTimes, FaQuestionCircle, FaPlay, FaEdit, 
  FaDownload, FaSignOutAlt, FaSearch, FaDesktop 
} from "react-icons/fa"
import { jsPDF } from "jspdf"
import "../AdminDashboard.css"
import { generateExamQuestions } from "../utils/groqService"

// Modal component for viewing/editing questions
const QuestionModal = ({ exam, onClose, onSave }) => {
  const [editedQuestions, setEditedQuestions] = useState([...exam.questions])
  const [isSaving, setIsSaving] = useState(false)
  
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
                      backgroundColor: q.type === 'mcq' ? '#2b7cff' : '#ffffff',
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
                      backgroundColor: q.type === 'answerable' ? '#2b7cff' : '#ffffff',
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
              style={{ padding: '8px 16px', backgroundColor: '#2b7cff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
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

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Logged out successfully");
      navigate('/login');
    } catch (err) {
      console.error("Logout failed:", err);
      toast.error("Failed to log out. Please try again.");
    }
  };

  // Navigation states
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
  const [recentFlags, setRecentFlags] = useState([]);
  const [selectedAttemptLogs, setSelectedAttemptLogs] = useState([]);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [latencyMs, setLatencyMs] = useState(120);
  const [totalFlagsCount, setTotalFlagsCount] = useState(0);
  const [integrityScore, setIntegrityScore] = useState('98.4%');
  const [flagBreakdown, setFlagBreakdown] = useState({
    TAB_SWITCH: 0,
FACE_NOT_FOUND: 0,
    MULTIPLE_FACES: 0,
    LOOKING_AWAY: 0,
    COCO_SSD_OBJECT: 0
  });

  // Create Exam Flow States
  const [createExamTitle, setCreateExamTitle] = useState("");
  const [createExamSubject, setCreateExamSubject] = useState("");
  const [createExamDuration, setCreateExamDuration] = useState(60);
  const [createExamEmail, setCreateExamEmail] = useState("");
  const [createExamInstructions, setCreateExamInstructions] = useState("");
  const [createExamQuestions, setCreateExamQuestions] = useState([
    { question: "", type: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correct_answer: "A" },
  ]);
  const [createExamShowJsonInput, setCreateExamShowJsonInput] = useState(false);
  const [createExamJsonInput, setCreateExamJsonInput] = useState('');
  const [createExamAiTopic, setCreateExamAiTopic] = useState('');
  const [createExamIsGenerating, setCreateExamIsGenerating] = useState(false);
  const [createExamNumQuestions, setCreateExamNumQuestions] = useState(10);
  const [createExamWebcamProctoring, setCreateExamWebcamProctoring] = useState(true);
  const [createExamStrictTabs, setCreateExamStrictTabs] = useState(false);
  const [createExamRandomizeQuestions, setCreateExamRandomizeQuestions] = useState(true);
  const [createExamEnableCalculator, setCreateExamEnableCalculator] = useState(false);
  const [createExamTotalMarks, setCreateExamTotalMarks] = useState(100);

  const addCreateExamQuestion = () => {
    setCreateExamQuestions([
      ...createExamQuestions,
      { question: "", type: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correct_answer: "A" }
    ]);
  };

  const removeCreateExamQuestion = (index) => {
    if (createExamQuestions.length > 1) {
      setCreateExamQuestions(createExamQuestions.filter((_, i) => i !== index));
    }
  };

  const handleCreateExamQuestionChange = (i, field, value) => {
    const updated = [...createExamQuestions];
    updated[i][field] = value;
    setCreateExamQuestions(updated);
  };

  const handleCreateExamAiGenerate = async () => {
    if (!createExamAiTopic.trim()) {
      toast.error('Please enter a topic for question generation');
      return;
    }
    setCreateExamIsGenerating(true);
    try {
      const generated = await generateExamQuestions(createExamAiTopic, createExamNumQuestions);
      setCreateExamQuestions(generated);
      toast.success(`Generated ${generated.length} questions successfully!`);
      setCreateExamAiTopic('');
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error(error.message || 'Failed to generate questions');
    } finally {
      setCreateExamIsGenerating(false);
    }
  };

  const handleCreateExamJsonImport = () => {
    try {
      if (!createExamJsonInput.trim()) {
        toast.error('Please enter JSON data');
        return;
      }
      const parsed = JSON.parse(createExamJsonInput);
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
      
      const validated = parsed.map((q, idx) => {
        if (!q.question) throw new Error(`Question at index ${idx} is missing text`);
        if (!q.type || !['mcq', 'answerable'].includes(q.type)) throw new Error(`Question at index ${idx} has invalid type`);
        return q;
      });
      
      setCreateExamQuestions(validated);
      setCreateExamShowJsonInput(false);
      setCreateExamJsonInput('');
      toast.success(`Successfully imported ${validated.length} questions!`);
    } catch (err) {
      toast.error(`Invalid JSON: ${err.message}`);
    }
  };

  const handleCreateExamSubmit = async (e) => {
    e.preventDefault();
    if (!createExamTitle.trim()) {
      toast.error('Please enter an exam title');
      return;
    }
    if (createExamQuestions.some(q => !q.question.trim())) {
      toast.error('Please fill in all question fields');
      return;
    }

    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error('User authentication error');

      const config = {
        webcam_proctoring: createExamWebcamProctoring,
        strict_tabs: createExamStrictTabs,
        randomize_questions: createExamRandomizeQuestions,
        enable_calculator: createExamEnableCalculator,
        total_marks: createExamTotalMarks
      };
      const instructionsWithConfig = `${createExamInstructions}\n\n---CONFIG---\n${JSON.stringify(config)}`;

      const { error } = await supabase.from("exams").insert([
        {
          title: createExamTitle,
          subject: createExamSubject,
          duration_minutes: createExamDuration,
          support_email: createExamEmail,
          instructions: instructionsWithConfig,
          questions: createExamQuestions,
          created_by: user.id
        }
      ]);

      if (error) throw error;
      toast.success("Exam created successfully!");
      
      // Clear forms
      setCreateExamTitle("");
      setCreateExamSubject("");
      setCreateExamDuration(60);
      setCreateExamEmail("");
      setCreateExamInstructions("");
      setCreateExamQuestions([{ question: "", type: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correct_answer: "A" }]);
      
      await loadDashboardData();
      setActiveTab('exams');
    } catch (err) {
      console.error(err);
      toast.error("Failed to create exam: " + err.message);
    }
  };

  const handleReportIncident = async () => {
    if (!selectedAttempt) return;
    try {
      const { error } = await supabase
        .from('exam_attempts')
        .update({ status: 'flagged' })
        .eq('id', selectedAttempt.id);

      if (error) throw error;
      
      setSelectedAttempt(prev => prev ? { ...prev, status: 'flagged' } : null);
      setUserAttempts(prev => prev.map(a => a.id === selectedAttempt.id ? { ...a, status: 'flagged' } : a));
      
      toast.success("Exam attempt has been reported and flagged!");
    } catch (err) {
      console.error("Failed to report exam attempt:", err);
      toast.error("Failed to report exam. Please try again.");
    }
  };
  const downloadCandidatePDF = (attempt) => {
    try {
      const exam = exams.find(e => e.id === attempt.exam_id);
      if (!exam) {
        alert("Exam details not found.");
        return;
      }
      
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let y = 25;

      const drawHeader = () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(5, 150, 105); // Green (#059669)
        pdf.text("Examlytic", margin, y);

        pdf.setFont("helvetica", "light");
        pdf.setFontSize(18);
        pdf.setTextColor(209, 213, 219);
        pdf.text("|", margin + 31, y - 0.5);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(75, 85, 99);
        pdf.text("OFFICIAL CANDIDATE REPORT", margin + 35, y - 1);

        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.5);
        pdf.line(margin, y + 4, pageWidth - margin, y + 4);
        y += 12;
      };

      drawHeader();

      // Info Box
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(margin, y, contentWidth, 36, 3, 3, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("CANDIDATE NAME", margin + 6, y + 8);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(17, 24, 39);
      pdf.text(attempt.user_name || "N/A", margin + 6, y + 14);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("CANDIDATE EMAIL", margin + 6, y + 23);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(75, 85, 99);
      pdf.text(attempt.user_email || "N/A", margin + 6, y + 29);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("ASSESSMENT TITLE", margin + 85, y + 8);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(17, 24, 39);
      pdf.text(attempt.exam_title || "N/A", margin + 85, y + 14);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("SCORE / SUBMITTED DATE", margin + 85, y + 23);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(75, 85, 99);
      const formattedDate = new Date(attempt.submitted_at).toLocaleDateString();
      pdf.text(`${Number(attempt.score).toFixed(1)}%  (${formattedDate})`, margin + 85, y + 29);

      y += 48;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(17, 24, 39);
      pdf.text("Detailed Question Responses", margin, y);
      y += 8;

      const questionsList = exam.questions || [];
      const answersMap = attempt.answers || {};

      questionsList.forEach((q, index) => {
        if (y > pageHeight - 40) {
          pdf.addPage();
          y = 25;
          drawHeader();
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(17, 24, 39);
        const questionTitle = `Q${index + 1}: ${q.question_text || q.question || ""}`;
        const splitTitle = pdf.splitTextToSize(questionTitle, contentWidth);
        pdf.text(splitTitle, margin, y);
        y += (splitTitle.length * 5) + 2;

        const candidateAnswer = answersMap[q.id] || "No response";
        const isMcq = q.type === 'mcq';
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.setTextColor(75, 85, 99);
        
        if (isMcq) {
          const isCorrect = q.correct_answer === candidateAnswer;
          pdf.text(`Candidate Answer: Option ${candidateAnswer}`, margin + 5, y);
          y += 5;
          pdf.text(`Correct Answer: Option ${q.correct_answer}`, margin + 5, y);
          y += 5;
          pdf.setFont("helvetica", "bold");
          if (isCorrect) {
            pdf.setTextColor(5, 150, 105);
            pdf.text("✓ Correct Answer", margin + 5, y);
          } else {
            pdf.setTextColor(220, 38, 38);
            pdf.text("✗ Incorrect Answer", margin + 5, y);
          }
          pdf.setTextColor(75, 85, 99);
          y += 8;
        } else {
          pdf.text("Candidate's Text Response:", margin + 5, y);
          y += 5;
          pdf.setFont("helvetica", "oblique");
          const splitAnswer = pdf.splitTextToSize(candidateAnswer, contentWidth - 10);
          pdf.text(splitAnswer, margin + 5, y);
          y += (splitAnswer.length * 4.5) + 6;
        }
      });

      pdf.save(`Candidate_${attempt.user_name || "Attempt"}_Report.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Check logs.");
    }
  };

  const [stats, setStats] = useState({
    activeExaminees: 0,
    completionRate: '0%',
    proctoringFlag: 'Low',
    proctoringAlerts: '0 Alerts',
    averageScore: '0'
  });

  const loadDashboardData = async () => {
    const startTime = performance.now();
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

      // 5. Fetch recent logs for active attempts from exam_flags
      let activeWithLogs = active.map(a => ({ ...a, flagsCount: 0, latestFlag: null }));
      const { data: activeFlags, error: activeFlagsError } = await supabase
        .from('exam_flags')
        .select('*')
        .order('timestamp', { ascending: false });

      if (!activeFlagsError && activeFlags) {
        activeWithLogs = active.map(a => {
          const studentFlags = activeFlags.filter(flag => flag.exam_id === a.exam_id && flag.user_id === a.student_id);
          return {
            ...a,
            flagsCount: studentFlags.length,
            latestFlag: studentFlags[0] || null,
            flags: studentFlags
          };
        });
      }
      setActiveAttempts(activeWithLogs);

      // Fetch recent flags globally for real-time Warning Log table
      const { data: recentFlagsData, error: recentFlagsError } = await supabase
        .from('exam_flags')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (!recentFlagsError && recentFlagsData) {
        const flagsWithUser = recentFlagsData.map(flag => {
          const userObj = (usersData || []).find(u => u.id === flag.user_id);
          return {
            ...flag,
            user_name: userObj?.user_name || userObj?.email?.split('@')[0] || 'Unknown Student',
            user_email: userObj?.email || 'N/A'
          };
        });
        setRecentFlags(flagsWithUser);
      }

      // Fetch all flags & logs for aggregate analytics calculations
      const { data: allFlags, error: allFlagsErr } = await supabase
        .from('exam_flags')
        .select('*');

      const { data: allLogs } = await supabase
        .from('exam_logs')
        .select('event_type');

      if (!allFlagsErr && allFlags) {
        const tabSwaps = (allLogs || []).filter(l => l.event_type === 'TAB_SWITCH').length;
        setTotalFlagsCount(allFlags.length + tabSwaps);

        const breakdown = {
          TAB_SWITCH: tabSwaps,
          FACE_NOT_FOUND: 0,
          MULTIPLE_FACES: 0,
          LOOKING_AWAY: 0,
          COCO_SSD_OBJECT: 0
        };

        allFlags.forEach(f => {
          const key = f.flag_type;
          if (breakdown[key] !== undefined) {
            breakdown[key]++;
          } else {
            breakdown[key] = (breakdown[key] || 0) + 1;
          }
        });
        setFlagBreakdown(breakdown);

        const totalSusEvents = allFlags.length + tabSwaps;
        const score = Math.max(60, 100 - (totalSusEvents * 1.5)).toFixed(1);
        setIntegrityScore(`${score}%`);
      }

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

      // Calculate latency roundtrip
      const endTime = performance.now();
      setLatencyMs(Math.round(endTime - startTime));

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
    const interval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (examId) {
      const matched = exams.find(e => e.id === examId);
      if (matched) {
        setSelectedExam(matched);
        setActiveTab('dashboard');
      }
    }
  }, [examId, exams]);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => {
    const fetchAttemptData = async () => {
      if (!selectedAttempt) {
        setSelectedAttemptLogs([]);
        return;
      }
      
      // Fetch logs
      const { data: logsData, error: logsError } = await supabase
        .from('exam_logs')
        .select('*')
        .eq('exam_attempt_id', selectedAttempt.id)
        .order('timestamp', { ascending: true });
        
      // Fetch flags
      const { data: flagsData, error: flagsError } = await supabase
        .from('exam_flags')
        .select('*')
        .eq('exam_id', selectedAttempt.exam_id)
        .eq('user_id', selectedAttempt.student_id)
        .order('timestamp', { ascending: true });

      const combined = [
        ...(logsData || []).map(l => ({ ...l, isFlag: false, type: l.event_type })),
        ...(flagsData || []).map(f => ({ ...f, isFlag: true, type: f.flag_type, message: `Anomaly Detected: ${f.flag_type}` }))
      ].sort((a, b) => new Date(a.timestamp || a.created_at) - new Date(b.timestamp || b.created_at));

      if (!logsError && !flagsError) {
        setSelectedAttemptLogs(combined);
      }
    };
    fetchAttemptData();
  }, [selectedAttempt]);
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
      await navigator.clipboard.writeText(examId);
      setCopied(true);
      toast.success("Exam code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
      toast.error("Failed to copy code.");
    }
  };

  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (exam.subject && exam.subject.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredStudents = users.filter(user => {
    const query = searchQuery || studentSearchQuery;
    return user.email.toLowerCase().includes(query.toLowerCase()) ||
      (user.user_name && user.user_name.toLowerCase().includes(query.toLowerCase()));
  });

  const filteredActiveAttempts = activeAttempts.filter(attempt => 
    attempt.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attempt.user_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRecentFlags = recentFlags.filter(flag => 
    flag.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (flag.flag_type && flag.flag_type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (initialLoad) {
    return <Loader fullPage message="Loading Admin Panel..." />;
  }



  return (
    <div className="admin-dashboard-layout">
      
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span className="brand-main">Examlytic</span>
          <span className="brand-sub">PROCTOR ADMIN</span>
        </div>

        <nav className="sidebar-menu">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedUser(null); }}
            className={`sidebar-item ${activeTab === 'dashboard' && !selectedUser ? 'active' : ''}`}
          >
            <FaThLarge /> Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab('exams'); setSelectedUser(null); }}
            className={`sidebar-item ${activeTab === 'exams' ? 'active' : ''}`}
          >
            <FaBook /> Exams
          </button>
          <button 
            onClick={() => { setActiveTab('students'); setSelectedUser(null); setSelectedAttempt(null); }}
            className={`sidebar-item ${activeTab === 'students' && !selectedUser ? 'active' : ''}`}
          >
            <FaUser /> Students & Recordings
          </button>
          <button 
            onClick={() => { setActiveTab('analytics'); setSelectedUser(null); }}
            className={`sidebar-item ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            <FaChartLine /> Analytics
          </button>
          <button 
            onClick={() => { setActiveTab('settings'); setSelectedUser(null); }}
            className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <FaCog /> Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={() => { setActiveTab('create-exam'); setSelectedUser(null); setSelectedAttempt(null); }} className="btn-new-exam-session" style={{ marginBottom: '16px', backgroundColor: activeTab === 'create-exam' ? '#047857' : '#059669' }}>
            <FaPlus /> Create New Exam
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="admin-main-container">
        
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#111827' }}>
              {selectedUser ? "Students" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </span>
            <div className="live-session-badge">
              Live Session Active
            </div>
          </div>

          <div className="topbar-right">
            <div className="search-input-wrapper">
              <FaSearch className="search-icon-svg" />
              <input 
                type="text" 
                placeholder={activeTab === 'exams' ? "Search assessments..." : "Search examinees or exams..."} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '1rem', padding: '0 8px', display: 'flex', alignItems: 'center' }}
                >
                  &times;
                </button>
              )}
            </div>
             <div className="avatar-container" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', marginLeft: '36px' }}>
              <div className="avtar-wrapper" onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} style={{ cursor: 'pointer' }}>
                <img 
                  src="https://cdn-icons-png.flaticon.com/128/1999/1999625.png" 
                  alt="User Avatar"  
                  className="user-avatar-img"
                  style={{ margin: 0 }}
                />
              </div>
              {isProfileDropdownOpen && (
                <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '8px', backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', zIndex: 10, padding: '4px', minWidth: '120px' }}>
                  <button 
                    onClick={handleLogout} 
                    style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '8px 12px', fontSize: '0.85rem', color: '#EF4444', fontWeight: 600, cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#FEF2F2'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <FaSignOutAlt /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="admin-content">
          
          {error && (
            <div className="error-alert" style={{ marginBottom: '24px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '12px 16px', borderRadius: '8px' }}>
              <strong>Error: </strong> {error}
            </div>
          )}

          {/* TAB 1: DASHBOARD OVERVIEW (Mockup 1) */}
          {activeTab === 'dashboard' && !selectedUser && (
            <>
              {/* Stats Grid */}
              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">Active Examinees</span>
                    <FaUser className="stat-icon" />
                  </div>
                  <h3 className="stat-value">{stats.activeExaminees}</h3>
                  <div className="stat-subtext">
                    <span className="stat-subtext-green">↗ Live</span> sessions active
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">System Alerts</span>
                    <FaExclamationTriangle className="stat-icon" />
                  </div>
                  <h3 className="stat-value">{stats.proctoringAlerts}</h3>
                  <div className="stat-subtext">
                    <span className={`critical-badge ${stats.proctoringFlag.toLowerCase()}`}>{stats.proctoringFlag}</span> Risk Level
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">Avg. Class Score</span>
                    <FaChartLine className="stat-icon" />
                  </div>
                  <h3 className="stat-value">{stats.averageScore}%</h3>
                  <div className="stat-progress-bar-container">
                    <div className="stat-progress-bar" style={{ width: `${stats.averageScore}%`, backgroundColor: '#8B5CF6' }}></div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">Completion Rate</span>
                    <FaCheck className="stat-icon" />
                  </div>
                  <h3 className="stat-value">{stats.completionRate}</h3>
                  <div className="stat-progress-bar-container">
                    <div className="stat-progress-bar" style={{ width: stats.completionRate, backgroundColor: '#2b7cff' }}></div>
                  </div>
                </div>
              </section>

              {/* Live Monitor streams */}
              <section className="live-monitor-container">
                <div className="live-monitor-header">
                  <div className="live-monitor-title">
                    <h2>Live Monitor</h2>
                    <p>Real-time AI behavioral analysis and webcam streams.</p>
                  </div>
                  <div className="live-monitor-actions">
                    <button className="btn-monitor-action"><FaThLarge /> Filter Feed</button>
                    <button className="btn-monitor-action"><FaList /> Layout</button>
                  </div>
                </div>

                <div className="live-monitor-grid">
                  {filteredActiveAttempts.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '40px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#6B7280' }}>
                      <FaVideo size={48} style={{ color: '#9CA3AF', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>No Active Proctored Sessions</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>Examinees currently taking tests will appear here in real-time.</p>
                    </div>
                  ) : (
                    filteredActiveAttempts.map((attempt) => {
                      const hasFlags = attempt.flagsCount > 0;
                      let badgeType = 'green';
                      let statusText = 'CLEAR';
                      let descText = 'Secure & Active';
                      
                      if (hasFlags && attempt.latestFlag) {
                        const flagType = attempt.latestFlag.flag_type;
                        if (['MULTIPLE_FACES_DETECTED', 'NO_FACE_DETECTED'].includes(flagType)) {
                          badgeType = 'red';
                          statusText = flagType.replace(/_/g, ' ');
                          descText = flagType === 'MULTIPLE_FACES_DETECTED' ? 'Co-presence detected in frame' : 'Face out of camera feed';
                        } else {
                          badgeType = 'yellow';
                          statusText = flagType.replace(/_/g, ' ');
                          descText = `Behavioral anomaly: ${flagType.replace(/_/g, ' ')}`;
                        }
                      }
                      
                      return (
                        <div key={attempt.id} className="live-monitor-card" style={{ cursor: 'pointer' }} onClick={() => {
                          const studentUser = users.find(u => u.id === attempt.student_id);
                          if (studentUser) {
                            setSelectedUser(studentUser);
                            setSelectedAttempt(attempt);
                            setActiveTab('students');
                          }
                        }}>
                          <div className="live-monitor-video-box">
                            <div className="disconnected-placeholder" style={{ backgroundColor: '#111827' }}>
                              <FaVideo size={32} />
                              <span style={{ fontSize: '0.75rem', marginTop: '8px' }}>LIVE FEED ACTIVE</span>
                            </div>
                            <span className={`live-monitor-overlay-badge badge-${badgeType}`}>
                              {badgeType === 'red' && <FaExclamationTriangle size={10} />}
                              {statusText}
                            </span>
                          </div>
                          <div className="live-monitor-card-details">
                            <div className="live-monitor-info-row">
                              <span className="live-monitor-name">{attempt.user_name}</span>
                              <span className="live-monitor-tab-tag">ID: {attempt.student_id.slice(0,6).toUpperCase()}</span>
                            </div>
                            <span className={`live-monitor-alert-desc alert-desc-${badgeType}`}>
                              {badgeType === 'red' && <span style={{ marginRight: '4px' }}>⚠️</span>}
                              {descText}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Bottom warning log and infra health card */}
              <div className="bottom-split-row">
                <div className="warning-log-card">
                  <div className="warning-log-header">
                    <h3>Real-time Warning Log</h3>
                    <button className="btn-view-logs" onClick={() => setActiveTab('students')}>View All Logs</button>
                  </div>
                  <table className="warning-log-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Examinee</th>
                        <th>Violation Type</th>
                        <th>Severity</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecentFlags.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#6B7280' }}>No proctoring violations recorded yet.</td>
                        </tr>
                      ) : (
                        filteredRecentFlags.map((flag) => {
                          let severity = 'low';
                          if (['MULTIPLE_FACES_DETECTED', 'NO_FACE_DETECTED'].includes(flag.flag_type)) {
                            severity = 'high';
                          } else if (flag.flag_type === 'LOOKING_AWAY') {
                            severity = 'medium';
                          }
                          
                          return (
                            <tr key={flag.id}>
                              <td>{new Date(flag.timestamp || flag.created_at).toLocaleTimeString()}</td>
                              <td>{flag.user_name}</td>
                              <td>{flag.flag_type.replace(/_/g, ' ')}</td>
                              <td>
                                <span className={`severity-pill pill-${severity}`}>
                                  {severity}
                                </span>
                              </td>
                              <td>
                                <button 
                                  onClick={() => {
                                    const studentUser = users.find(u => u.id === flag.user_id);
                                    if (studentUser) {
                                      setSelectedUser(studentUser);
                                      const matchedAttempt = userAttempts.find(a => a.student_id === flag.user_id && a.exam_id === flag.exam_id);
                                      setSelectedAttempt(matchedAttempt || userAttempts.find(a => a.student_id === flag.user_id) || null);
                                      setActiveTab('students');
                                    }
                                  }} 
                                  className="btn-review-link"
                                >
                                  Review
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="infra-health-card">
                  <h3>Infrastructure Health</h3>
                  {(() => {
                    const serverLoad = Math.max(5, Math.min(100, activeAttempts.length * 8));
                    const serverStatus = serverLoad > 70 ? 'High' : (serverLoad > 30 ? 'Normal' : 'Stable');
                    const serverColorClass = serverLoad > 70 ? 'value-red' : (serverLoad > 30 ? 'value-black' : 'value-green');
                    const serverBarClass = serverLoad > 70 ? 'bg-red' : (serverLoad > 30 ? 'bg-blue' : 'bg-green');

                    const apiLatency = latencyMs;
                    const apiStatus = apiLatency > 500 ? 'Slow' : 'Fast';
                    const apiColorClass = apiLatency > 500 ? 'value-red' : 'value-green';
                    const apiBarWidth = Math.min(100, Math.max(10, (apiLatency / 500) * 100));

                    const queueCount = activeAttempts.length * 2;
                    const queueStatus = queueCount === 0 ? 'Idle' : `${queueCount} tasks`;
                    const queueBarWidth = Math.min(100, Math.max(5, queueCount * 10));

                    return (
                      <div className="infra-health-row">
                        <div className="infra-metric-box">
                          <div className="infra-metric-header">
                            <span>Video Server Load</span>
                            <span className={`infra-metric-value ${serverColorClass}`}>{serverStatus} ({serverLoad}%)</span>
                          </div>
                          <div className="infra-progress-bar-bg">
                            <div className={`infra-progress-bar-fill ${serverBarClass}`} style={{ width: `${serverLoad}%` }}></div>
                          </div>
                        </div>

                        <div className="infra-metric-box">
                          <div className="infra-metric-header">
                            <span>API Response Time</span>
                            <span className={`infra-metric-value ${apiColorClass}`}>{apiLatency}ms ({apiStatus})</span>
                          </div>
                          <div className="infra-progress-bar-bg">
                            <div className="infra-progress-bar-fill bg-blue" style={{ width: `${apiBarWidth}%` }}></div>
                          </div>
                        </div>

                        <div className="infra-metric-box">
                          <div className="infra-metric-header">
                            <span>AI Processing Queue</span>
                            <span className="infra-metric-value value-black">{queueStatus}</span>
                          </div>
                          <div className="infra-progress-bar-bg">
                            <div className="infra-progress-bar-fill bg-purple" style={{ width: `${queueBarWidth}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="infra-status-text">All monitoring subsystems operational.</div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: EXAMS MANAGER (Mockup 2) */}
          {activeTab === 'exams' && !selectedUser && (
            <>
              <div className="exams-manager-header">
                <h2>Exams Manager</h2>
                <p>Configure and monitor your active assessment pool.</p>
              </div>

              {/* Exams Stats Row */}
              <div className="exams-stats-row">
                <div className="exams-stat-card">
                  <div className="exams-stat-label">Total Exams</div>
                  <div className="exams-stat-value">{exams.length}</div>
                  <div style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 'bold' }}>↗ Active Assessment Pool</div>
                </div>
                <div className="exams-stat-card">
                  <div className="exams-stat-label">Active Candidates</div>
                  <div className="exams-stat-value">{stats.activeExaminees}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Across live proctored sessions</div>
                </div>
                <div className="exams-stat-card">
                  <div className="exams-stat-label">Integrity Score</div>
                  <div className="exams-stat-value">{integrityScore}</div>
                  <div className="stat-progress-bar-container" style={{ marginTop: '12px' }}>
                    <div className="stat-progress-bar" style={{ width: integrityScore, backgroundColor: '#2b7cff' }}></div>
                  </div>
                </div>
              </div>

              {/* Table Card */}
              <div className="exams-table-card">
                <div className="exams-table-wrapper">
                  <table className="exams-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Questions</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExams.map(exam => {
                        const count = userAttempts.filter(a => a.exam_id === exam.id).length;
                        return (
                          <tr key={exam.id}>
                            <td>
                              <div style={{ fontWeight: 'bold', color: '#111827' }}>{exam.title}</div>
                              <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '2px' }}>{exam.duration_minutes} minutes</div>
                            </td>
                            <td>
                              <span className="subject-badge">{exam.subject || "AI"}</span>
                            </td>
                            <td>
                              <div className="exam-code-wrapper">
                                <span className="exam-code-box">{exam.id.slice(0, 6).toUpperCase()}</span>
                                <button className="btn-code-copy" onClick={() => copyToClipboard(exam.id)} title="Copy link">
                                  <FaCopy size={12} />
                                </button>
                              </div>
                            </td>
                            <td>{exam.questions_count || 45} Qs</td>
                            <td>
                              <div className="toggle-switch-wrapper">
                                <span className={`status-text-cell ${exam.is_active ? 'status-unlocked' : 'status-locked'}`}>
                                  {exam.is_active ? 'Unlocked' : 'Locked'}
                                </span>
                                <label className="toggle-switch">
                                  <input 
                                    type="checkbox" 
                                    checked={exam.is_active} 
                                    onChange={() => toggleExamStatus(exam.id, exam.is_active)}
                                  />
                                  <span className="toggle-slider"></span>
                                </label>
                              </div>
                            </td>
                            <td>
                              <div className="exam-actions-cell">
                                <button onClick={() => handleViewExam(exam)} className="btn-exam-action" title="Edit Questions">
                                  <FaEdit />
                                </button>
                                <button onClick={() => navigate(`/monitor/${exam.id}`)} className="btn-exam-action" title="Live stats">
                                  <FaVideo />
                                </button>
                                <button onClick={() => handleDeleteExam(exam.id)} className="btn-exam-action btn-exam-action-delete" title="Delete Exam">
                                  <FaTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pagination-footer">
                  <span className="pagination-text">Showing 1-{filteredExams.length} of {exams.length} assessments</span>
                  <div className="pagination-buttons">
                    <button className="pagination-btn">&lt;</button>
                    <button className="pagination-btn active">1</button>
                    <button className="pagination-btn">2</button>
                    <button className="pagination-btn">3</button>
                    <button className="pagination-btn">&gt;</button>
                  </div>
                </div>
              </div>

              {/* Bulk import banner */}
              <div className="bulk-import-banner">
                <div className="bulk-import-left">
                  <div className="bulk-import-icon-box">
                    <FaCheck size={16} />
                  </div>
                  <div className="bulk-import-text">
                    <h4>Need to bulk import?</h4>
                    <p>You can upload a CSV or JSON file to populate your exam list instantly. Go to the Settings page to find the import tool or contact support for help with migration.</p>
                  </div>
                </div>
                <button className="btn-launch-wizard" onClick={() => toast.info("Import Wizard coming soon!")}>Launch Import Wizard</button>
              </div>
            </>
          )}

          {/* TAB 3: STUDENTS & ATTEMPT DETAILS (Mockup 3) */}
          {selectedUser && (
            <div>
              {/* Breadcrumb Nav */}
              <div className="student-breadcrumb-nav">
                <span style={{ cursor: 'pointer', color: '#2b7cff' }} onClick={() => { setSelectedUser(null); setSelectedAttempt(null); }}>Students</span> <span>&gt;</span> Attempt Details
              </div>

              {/* Header Title with Buttons */}
              <div className="attempt-details-header-row">
                <div>
                  <h2>Video Recordings: {selectedUser.user_name || selectedUser.email.split('@')[0]}</h2>
                </div>
                <div className="attempt-details-actions-header">
                  <button className="btn-report-incident" onClick={handleReportIncident}>
                    <FaExclamationTriangle /> Report Incident
                  </button>
                  {selectedAttempt && (
                    <button className="btn-download-pdf-redesign" onClick={() => downloadCandidatePDF(selectedAttempt)}>
                      <FaDownload /> Download Answer Sheet PDF
                    </button>
                  )}
                </div>
              </div>

              {/* Main Attempt split layout */}
              <div className="student-attempt-layout-grid">
                {/* Left attempt history sidebar */}
                <div className="attempt-history-sidebar-card">
                  <h3>Attempt History</h3>
                  <div className="attempt-history-list">
                    {userAttempts
                      .filter(a => a.student_id === selectedUser.id)
                      .map(attempt => {
                        const isCurrent = selectedAttempt?.id === attempt.id;
                        const scoreVal = attempt.score !== null ? `${Number(attempt.score).toFixed(1)}%` : 'N/A';
                        const scoreColor = attempt.score !== null ? (Number(attempt.score) >= 50 ? 'score-text-green' : 'score-text-red') : 'score-text-grey';
                        
                        return (
                          <div 
                            key={attempt.id} 
                            onClick={() => setSelectedAttempt(attempt)}
                            className={`attempt-history-item ${isCurrent ? 'active' : ''}`}
                          >
                            <div className="attempt-history-header-row">
                              <span className="attempt-viewing-badge" style={{ color: isCurrent ? '#2b7cff' : '#6B7280' }}>
                                {isCurrent ? 'Currently Viewing' : `Score: ${scoreVal}`}
                              </span>
                              {isCurrent && <span className={`attempt-score-text ${scoreColor}`}>{scoreVal} Score</span>}
                            </div>
                            <div className="attempt-history-title">{attempt.exam_title}</div>
                            <div className="attempt-history-meta-row">
                              <span className="attempt-meta-date">
                                <FaHistory size={10} /> {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : 'In Progress'}
                              </span>
                              <span className={`attempt-meta-status ${attempt.recording_url ? 'status-ready' : 'status-corrupt'}`}>
                                {attempt.recording_url ? (
                                  <><FaPlay size={8} /> Video Ready</>
                                ) : (
                                  <><FaTimes size={8} /> No Video</>
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>

                {/* Right panel details */}
                <div className="video-detail-panel-right">
                  <div className="video-player-container-redesign">
                    {selectedAttempt?.recording_url ? (
                      <video controls playsInline preload="auto" key={selectedAttempt.id}>
                        <source src={selectedAttempt.recording_url} type="video/webm" />
                        <source src={selectedAttempt.recording_url} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div style={{ color: '#9CA3AF', textAlign: 'center' }}>
                        <FaVideo size={48} style={{ marginBottom: '12px' }} />
                        <p>No video player feed linked for this attempt.</p>
                      </div>
                    )}
                    <div className="player-floating-badges">
                      <span className="player-floating-badge">
                        <span className="player-badge-dot-red"></span> Live Monitoring
                      </span>
                      <span className="player-floating-badge">
                        <span className="player-badge-dot-green"></span> Eye Tracking: Stable
                      </span>
                    </div>
                  </div>

                  {/* Parameters Details Box */}
                  <div className="attempt-parameters-card">
                    <div className="attempt-params-summary-row">
                      <div className="attempt-param-box">
                        <span className="attempt-param-label">Attempt ID</span>
                        <span className="attempt-param-value">{selectedAttempt?.id.slice(0, 8).toUpperCase() || 'EX-9921'}</span>
                      </div>
                      <div className="attempt-param-box">
                        <span className="attempt-param-label">Subject</span>
                        <span className="attempt-param-value">{selectedAttempt?.exam_subject || 'Neural Networks'}</span>
                      </div>
                      <div className="attempt-param-box">
                        <span className="attempt-param-label">Submitted</span>
                        <span className="attempt-param-value">{selectedAttempt ? new Date(selectedAttempt.submitted_at).toLocaleDateString() : 'Oct 24, 2023'}</span>
                      </div>
                      <div className="attempt-param-box">
                        <span className="attempt-param-label">Environment</span>
                        <span className="attempt-param-value attempt-param-value-green">
                          <FaCheck size={10} /> Secure
                        </span>
                      </div>
                    </div>

                    {/* Progress indicators grid */}
                    {(() => {
                      const faceAlerts = selectedAttemptLogs.filter(l => l.isFlag && ['NO_FACE_DETECTED', 'MULTIPLE_FACES_DETECTED'].includes(l.type)).length;
                      const faceStatus = faceAlerts === 0 ? '100% Match' : `${faceAlerts} Alert${faceAlerts > 1 ? 's' : ''}`;
                      const faceWidth = faceAlerts === 0 ? '100%' : `${Math.max(10, 100 - (faceAlerts * 15))}%`;
                      const faceColor = faceAlerts === 0 ? '#10B981' : '#DC2626';

                      const tabSwaps = selectedAttemptLogs.filter(l => l.type === 'TAB_SWITCH').length;
                      const tabStatus = tabSwaps === 0 ? '0 Detected' : `${tabSwaps} Swapped`;
                      const tabWidth = tabSwaps === 0 ? '100%' : `${Math.max(10, 100 - (tabSwaps * 25))}%`;
                      const tabColor = tabSwaps === 0 ? '#10B981' : '#F59E0B';

                      const lookAlerts = selectedAttemptLogs.filter(l => l.isFlag && l.type === 'LOOKING_AWAY').length;
                      const lookStatus = lookAlerts === 0 ? 'Stable' : `${lookAlerts} Alert${lookAlerts > 1 ? 's' : ''}`;
                      const lookWidth = lookAlerts === 0 ? '100%' : `${Math.max(10, 100 - (lookAlerts * 15))}%`;
                      const lookColor = lookAlerts === 0 ? '#10B981' : '#F59E0B';

                      return (
                        <div className="attempt-details-indicators-grid">
                          <div className="attempt-indicator-card">
                            <div className="attempt-indicator-header">
                              <span>Face Recognition</span>
                              <span className="attempt-indicator-val" style={{ color: faceColor }}>{faceStatus}</span>
                            </div>
                            <div className="attempt-indicator-bar-bg">
                              <div className="attempt-indicator-bar-fill" style={{ width: faceWidth, backgroundColor: faceColor }}></div>
                            </div>
                          </div>

                          <div className="attempt-indicator-card">
                            <div className="attempt-indicator-header">
                              <span>Tab Switching</span>
                              <span className="attempt-indicator-val" style={{ color: tabColor }}>{tabStatus}</span>
                            </div>
                            <div className="attempt-indicator-bar-bg">
                              <div className="attempt-indicator-bar-fill" style={{ width: tabWidth, backgroundColor: tabColor }}></div>
                            </div>
                          </div>

                          <div className="attempt-indicator-card">
                            <div className="attempt-indicator-header">
                              <span>Eye Tracking</span>
                              <span className="attempt-indicator-val" style={{ color: lookColor }}>{lookStatus}</span>
                            </div>
                            <div className="attempt-indicator-bar-bg">
                              <div className="attempt-indicator-bar-fill" style={{ width: lookWidth, backgroundColor: lookColor }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Proctoring Timeline Log Feed */}
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FaHistory style={{ color: '#2b7cff' }} /> Anomaly Timeline & Log Feed
                    </h3>
                    {selectedAttemptLogs.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#6B7280', textAlign: 'center', padding: '12px 0' }}>No anomaly events logged for this session.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '220px', overflowY: 'auto', paddingRight: '8px' }}>
                        {selectedAttemptLogs.map((log, i) => {
                          const logTime = new Date(log.timestamp || log.created_at).toLocaleTimeString();
                          const isAnomaly = log.isFlag || ['TAB_SWITCH', 'FACE_NOT_FOUND', 'MULTIPLE_FACES', 'COCO_SSD_OBJECT'].includes(log.type);
                          const tagColor = isAnomaly ? '#DC2626' : '#059669';
                          const bgColor = isAnomaly ? '#FEF2F2' : '#F0FDF4';

                          return (
                            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', backgroundColor: bgColor, borderLeft: `4px solid ${tagColor}` }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', whiteSpace: 'nowrap' }}>{logTime}</span>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1F2937', display: 'block' }}>{log.type.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: '0.75rem', color: '#4B5563' }}>{log.message || 'Status verified secure'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* AI insight box */}
                  <div className="ai-proctor-insight-card">
                    <div className="ai-proctor-left">
                      <div className="ai-proctor-icon-box">
                        <FaChartLine />
                      </div>
                      <div className="ai-proctor-text">
                        <h4>AI-Generated Proctor Insight</h4>
                        <p>The candidate maintained consistent focus throughout the 22-minute session. Facial micro-expressions indicate high levels of concentration. No prohibited objects (phones, unauthorized materials) were detected by the peripheral camera stream. Tab focus was maintained for 100% of the session duration.</p>
                      </div>
                    </div>
                    <button className="btn-add-note" onClick={() => toast.info("Notes feature coming soon!")}>Add Note</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3 default layout (Directory selector if no student is selected) */}
          {activeTab === 'students' && !selectedUser && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 16px 0', fontWeight: 800 }}>Student Portal & Exam Recordings</h2>
                <div className="student-search-container">
                  <input 
                    type="text" 
                    placeholder="Search students by name or email..." 
                    className="student-search-input"
                    value={studentSearchQuery}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {filteredStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
                  <p>No students found matching your search.</p>
                </div>
              ) : (
                <div className="student-list-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {filteredStudents.map(student => {
                    const attempts = userAttempts.filter(a => a.student_id === student.id && a.submitted_at !== null);
                    const hasRecordings = attempts.filter(a => a.recording_url).length;

                    return (
                      <div 
                        key={student.id} 
                        className="student-list-card"
                        style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', cursor: 'pointer', display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: '#FFFFFF' }}
                        onClick={() => {
                          setSelectedUser(student);
                          setSelectedAttempt(attempts[0] || null);
                        }}
                      >
                        <div className="student-list-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {student.user_name ? student.user_name.slice(0, 2).toUpperCase() : 'ST'}
                        </div>
                        <div className="student-list-info" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <span className="student-list-name" style={{ fontWeight: 'bold', color: '#111827' }}>{student.user_name || student.email.split('@')[0]}</span>
                          <span className="student-list-email" style={{ fontSize: '0.8rem', color: '#6B7280' }}>{student.email}</span>
                        </div>
                        <div className="student-list-count" style={{ fontSize: '0.75rem', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                          {hasRecordings} Videos
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ANALYTICS (Overview Charts) */}
          {activeTab === 'analytics' && !selectedUser && (
            <div>
              {/* Header Title Banner */}
              <div style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderRadius: '16px', padding: '28px 36px', marginBottom: '28px', color: '#ffffff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
                <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>System Integrity Intelligence</h2>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem', color: '#A7F3D0', fontWeight: 500 }}>Advanced behavioral diagnostic metrics and real-time proctor engine audits.</p>
              </div>

              {/* Stats overview cards grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Flags</span>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>{totalFlagsCount}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '6px', fontWeight: 600 }}>▲ Dynamic event streams</span>
                </div>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Safety Index</span>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#059669' }}>{integrityScore}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#059669', marginTop: '6px', fontWeight: 600 }}>✓ Within secure thresholds</span>
                </div>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidates Tracked</span>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>{userAttempts.length}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '6px', fontWeight: 600 }}>Active examinees database</span>
                </div>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Session Streams</span>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#2b7cff' }}>{activeAttempts.length}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#2b7cff', marginTop: '6px', fontWeight: 600 }}>● Live monitoring active</span>
                </div>
              </div>

              {/* Two-Column Analytics Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '28px', marginBottom: '28px' }}>
                {/* Left Panel: Anomaly breakdown bars */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '1.15rem', fontWeight: 800, color: '#111827' }}>Anomalous Behavior Classification</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {(() => {
                      const categories = [
                        { label: 'Tab Swapping', key: 'TAB_SWITCH', color: '#2b7cff', icon: <FaDesktop style={{ color: '#2b7cff' }} /> },
                        { label: 'Face Missing', key: 'FACE_NOT_FOUND', color: '#EF4444', icon: <FaUser style={{ color: '#EF4444' }} /> },
                        { label: 'Multiple Faces', key: 'MULTIPLE_FACES', color: '#DC2626', icon: <FaUser style={{ color: '#DC2626' }} /> },
                        { label: 'Looking Away', key: 'LOOKING_AWAY', color: '#F59E0B', icon: <FaEye style={{ color: '#F59E0B' }} /> },
                        { label: 'Prohibited Objects', key: 'COCO_SSD_OBJECT', color: '#8B5CF6', icon: <FaExclamationTriangle style={{ color: '#8B5CF6' }} /> }
                      ];

                      const maxVal = Math.max(1, ...categories.map(c => flagBreakdown[c.key] || 0));

                      return categories.map(cat => {
                        const count = flagBreakdown[cat.key] || 0;
                        const percentage = ((count / (totalFlagsCount || 1)) * 100).toFixed(1);
                        const widthPct = totalFlagsCount > 0 ? (count / maxVal) * 100 : 0;

                        return (
                          <div key={cat.label} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {cat.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                                <span style={{ color: '#374151' }}>{cat.label}</span>
                                <span style={{ color: '#4B5563' }}>{count} alerts ({totalFlagsCount > 0 ? percentage : '0.0'}%)</span>
                              </div>
                              <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${widthPct}%`, backgroundColor: cat.color, borderRadius: '4px', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Right Panel: Radial SVG Integrity Score Circle */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 24px 0', fontSize: '1.15rem', fontWeight: 800, color: '#111827', width: '100%', textAlign: 'left' }}>System Health Audit</h3>
                  
                  {/* SVG Circle Progress Ring */}
                  {(() => {
                    const scoreNum = parseFloat(integrityScore) || 100.0;
                    const strokeDashoffset = 339.29 - (339.29 * scoreNum) / 100;
                    return (
                      <div style={{ position: 'relative', width: '160px', height: '160px', marginBottom: '20px' }}>
                        <svg width="100%" height="100%" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                          {/* Background Circle */}
                          <circle cx="60" cy="60" r="54" fill="transparent" stroke="#F1F5F9" strokeWidth="8" />
                          {/* Progress Circle */}
                          <circle 
                            cx="60" 
                            cy="60" 
                            r="54" 
                            fill="transparent" 
                            stroke={scoreNum > 85 ? '#059669' : (scoreNum > 70 ? '#F59E0B' : '#EF4444')} 
                            strokeWidth="8" 
                            strokeDasharray="339.29" 
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                          />
                        </svg>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '2.1rem', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em' }}>{integrityScore}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginTop: '2px' }}>Safety Index</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ width: '100%', borderTop: '1px solid #F1F5F9', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6B7280' }}>
                      <span>Class Score Average</span>
                      <strong style={{ color: '#111827' }}>{stats.averageScore}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6B7280' }}>
                      <span>Proctor System Latency</span>
                      <strong style={{ color: '#111827' }}>{latencyMs}ms</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Full-Width Column: Live Integrity Incident Log Feed */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 800, color: '#111827' }}>Incident Log Feed</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #F1F5F9', textAlign: 'left', color: '#6B7280', fontWeight: 700 }}>
                        <th style={{ padding: '12px' }}>Timestamp</th>
                        <th style={{ padding: '12px' }}>Candidate Name</th>
                        <th style={{ padding: '12px' }}>Flag Type</th>
                        <th style={{ padding: '12px' }}>Severity</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Review Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecentFlags.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>No security violations logged. All systems safe.</td>
                        </tr>
                      ) : (
                        filteredRecentFlags.slice(0, 5).map((flag, idx) => {
                          const isHigh = ['MULTIPLE_FACES_DETECTED', 'NO_FACE_DETECTED'].includes(flag.flag_type);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '12px', color: '#6B7280' }}>{new Date(flag.timestamp).toLocaleTimeString()}</td>
                              <td style={{ padding: '12px', fontWeight: 700, color: '#1F2937' }}>{flag.user_name}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#F1F5F9', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
                                  {flag.flag_type.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: isHigh ? '#FEF2F2' : '#FFFBEB', color: isHigh ? '#EF4444' : '#F59E0B', fontSize: '0.75rem', fontWeight: 700 }}>
                                  {isHigh ? 'High Severity' : 'Medium Severity'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right' }}>
                                <button 
                                  onClick={() => {
                                    const candidateUser = users.find(u => u.id === flag.user_id);
                                    if (candidateUser) {
                                      setSelectedUser(candidateUser);
                                      const attemptMatch = userAttempts.find(a => a.student_id === flag.user_id && a.exam_id === flag.exam_id);
                                      if (attemptMatch) setSelectedAttempt(attemptMatch);
                                      setActiveTab('students');
                                    }
                                  }}
                                  style={{ padding: '6px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: '#ffffff', color: '#2b7cff', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                >
                                  Inspect Session
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CREATE EXAM (Integrated Split Creator View) */}
          {activeTab === 'create-exam' && !selectedUser && (
            <div>
              {/* Green Header Banner */}
              <div style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderRadius: '16px', padding: '24px 36px', marginBottom: '28px', color: '#ffffff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
                <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Create New Exam</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#A7F3D0', fontWeight: 500 }}>Design and build your exam with advanced tools and AI assistance.</p>
              </div>

              <form onSubmit={handleCreateExamSubmit}>
                <div className="creator-split-layout">
                  {/* Left Column: Details & Questions */}
                  <div>
                    {/* Card 1: Exam Details */}
                    <div className="creator-card">
                      <div className="creator-card-header">
                        <FaBook style={{ color: '#059669' }} />
                        <h3>Exam Details</h3>
                      </div>
                      
                      <div className="creator-form-group">
                        <label>Exam Title <span style={{ color: '#EF4444' }}>*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. Advanced Thermodynamics Midterm" 
                          value={createExamTitle}
                          onChange={(e) => setCreateExamTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="creator-form-group">
                          <label>Subject</label>
                          <input 
                            type="text" 
                            placeholder="Physics" 
                            value={createExamSubject}
                            onChange={(e) => setCreateExamSubject(e.target.value)}
                          />
                        </div>
                        <div className="creator-form-group">
                          <label>Duration (Min) <span style={{ color: '#EF4444' }}>*</span></label>
                          <input 
                            type="number" 
                            placeholder="60" 
                            value={createExamDuration}
                            onChange={(e) => setCreateExamDuration(parseInt(e.target.value))}
                            required
                          />
                        </div>
                      </div>

                      <div className="creator-form-group">
                        <label>Support Email</label>
                        <input 
                          type="email" 
                          placeholder="proctor@examlytic.edu" 
                          value={createExamEmail}
                          onChange={(e) => setCreateExamEmail(e.target.value)}
                        />
                      </div>

                      <div className="creator-form-group" style={{ marginBottom: 0 }}>
                        <label>Exam Instructions</label>
                        <textarea 
                          placeholder="Specify instructions for students before they start the exam..." 
                          value={createExamInstructions}
                          onChange={(e) => setCreateExamInstructions(e.target.value)}
                          rows="4"
                        />
                      </div>
                    </div>

                    {/* Card 2: Import via JSON toggle */}
                    <div className="creator-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.1rem', color: '#475569', display: 'flex' }}>&lt;&gt;</span>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>Import via JSON</h3>
                      </div>
                      <label className="switch-input-wrapper">
                        <input 
                          type="checkbox" 
                          checked={createExamShowJsonInput}
                          onChange={(e) => setCreateExamShowJsonInput(e.target.checked)}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>

                    {createExamShowJsonInput && (
                      <div className="creator-card">
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                          <button 
                            type="button" 
                            onClick={() => setCreateExamJsonInput(JSON.stringify([
                              {
                                "question": "What is the primary product of photosynthesis?",
                                "type": "mcq",
                                "optionA": "Oxygen",
                                "optionB": "Glucose",
                                "optionC": "Carbon Dioxide",
                                "optionD": "Water",
                                "correct_answer": "B"
                              }
                            ], null, 2))}
                            className="btn btn-outline"
                            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                          >
                            Load Sample JSON
                          </button>
                          <button 
                            type="button" 
                            onClick={handleCreateExamJsonImport}
                            className="btn btn-primary"
                            style={{ padding: '8px 16px', fontSize: '0.8rem', backgroundColor: '#059669' }}
                          >
                            Import Questions Array
                          </button>
                        </div>
                        <textarea
                          placeholder="Paste JSON array format of questions here..."
                          value={createExamJsonInput}
                          onChange={(e) => setCreateExamJsonInput(e.target.value)}
                          rows="6"
                          className="json-textarea"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}

                    {/* Section: Questions Manual List */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>Questions</h3>
                      <button 
                        type="button" 
                        onClick={addCreateExamQuestion}
                        style={{ border: 'none', background: 'none', color: '#2b7cff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <FaPlus size={12} style={{ marginRight: '6px' }} /> Add Manually
                      </button>
                    </div>

                    <div className="questions-list-wrapper">
                      {createExamQuestions.map((q, idx) => (
                        <div key={idx} className="creator-question-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span className="q-badge">QUESTION {(idx + 1).toString().padStart(2, '0')}</span>
                            
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                              <div className="q-type-tabs" style={{ width: '220px' }}>
                                <button 
                                  type="button" 
                                  className={`q-tab-btn ${q.type === 'mcq' ? 'active' : ''}`}
                                  onClick={() => handleCreateExamQuestionChange(idx, 'type', 'mcq')}
                                >
                                  Multiple Choice
                                </button>
                                <button 
                                  type="button" 
                                  className={`q-tab-btn ${q.type === 'answerable' ? 'active' : ''}`}
                                  onClick={() => handleCreateExamQuestionChange(idx, 'type', 'answerable')}
                                >
                                  Written Answer
                                </button>
                              </div>
                              {createExamQuestions.length > 1 && (
                                <button 
                                  type="button" 
                                  className="btn-delete"
                                  onClick={() => removeCreateExamQuestion(idx)}
                                >
                                  <FaTrash size={10} style={{ marginRight: '4px' }} /> Remove
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="creator-form-group">
                            <label>Question Text <span style={{ color: '#EF4444' }}>*</span></label>
                            <textarea 
                              placeholder="Enter your question here..." 
                              value={q.question}
                              onChange={(e) => handleCreateExamQuestionChange(idx, 'question', e.target.value)}
                              rows="3"
                              required
                            />
                          </div>

                          {q.type === 'mcq' ? (
                            <div className="mcq-options">
                              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>Options & Key <span style={{ color: '#EF4444' }}>*</span></label>
                              {['A', 'B', 'C', 'D'].map((opt) => (
                                <div key={opt} className="option-row">
                                  <div className="option-radio">
                                    <input 
                                      type="radio" 
                                      name={`correct-${idx}`}
                                      checked={q.correct_answer === opt}
                                      onChange={() => handleCreateExamQuestionChange(idx, 'correct_answer', opt)}
                                    />
                                    <span className="option-letter">{opt}.</span>
                                  </div>
                                  <input 
                                    type="text" 
                                    placeholder={`Option ${opt}`}
                                    value={q[`option${opt}`] || ''}
                                    onChange={(e) => handleCreateExamQuestionChange(idx, `option${opt}`, e.target.value)}
                                    className="option-input"
                                    required={q.type === 'mcq'}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="creator-form-group" style={{ marginBottom: 0 }}>
                              <label>Expected Answer <span style={{ color: '#EF4444' }}>*</span></label>
                              <textarea 
                                placeholder="Enter the expected answer or key points..." 
                                value={q.correct_answer || ''}
                                onChange={(e) => handleCreateExamQuestionChange(idx, 'correct_answer', e.target.value)}
                                rows="3"
                                required={q.type === 'answerable'}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                      <button 
                        type="button" 
                        onClick={() => { setActiveTab('exams'); }}
                        className="btn btn-text"
                      >
                        ← Back to List
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        style={{ backgroundColor: '#059669', padding: '12px 32px' }}
                      >
                        Create Exam
                      </button>
                    </div>
                  </div>

                  {/* Right Column: AI Proctor Copilot & Security & Logic */}
                  <div>
                    {/* Card 3: AI Proctor Copilot */}
                    <div className="copilot-dark-card">
                      <h3>🪄 AI Proctor Copilot</h3>
                      <p>Generate high-quality questions instantly using our trained LLM.</p>
                      
                      <div className="copilot-form-group">
                        <label>Topic / Context</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Newton's 3rd Law" 
                          value={createExamAiTopic}
                          onChange={(e) => setCreateExamAiTopic(e.target.value)}
                        />
                      </div>

                      <div className="copilot-form-group">
                        <label>Question Count</label>
                        <select 
                          value={createExamNumQuestions}
                          onChange={(e) => setCreateExamNumQuestions(parseInt(e.target.value))}
                        >
                          <option value="5">5 Questions</option>
                          <option value="10">10 Questions</option>
                          <option value="15">15 Questions</option>
                          <option value="20">20 Questions</option>
                        </select>
                      </div>

                      <button 
                        type="button" 
                        onClick={handleCreateExamAiGenerate}
                        disabled={createExamIsGenerating}
                        className="copilot-generate-btn"
                      >
                        {createExamIsGenerating ? 'Generating...' : '⚡ Generate Questions'}
                      </button>
                    </div>

                    {/* Card 4: Security & Logic */}
                    <div className="creator-card">
                      <div className="creator-card-header">
                        <FaLock style={{ color: '#059669' }} />
                        <h3>Security & Logic</h3>
                      </div>

                      <div className="logic-switch-row">
                        <div className="logic-label-col">
                          <span className="logic-title">AI Video Proctoring</span>
                          <span className="logic-desc">Real-time eye tracking & flagging</span>
                        </div>
                        <label className="switch-input-wrapper">
                          <input 
                            type="checkbox" 
                            checked={createExamWebcamProctoring}
                            onChange={(e) => setCreateExamWebcamProctoring(e.target.checked)}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="logic-switch-row">
                        <div className="logic-label-col">
                          <span className="logic-title">Strict Tab Restrictions</span>
                          <span className="logic-desc">Lock browser until completion</span>
                        </div>
                        <label className="switch-input-wrapper">
                          <input 
                            type="checkbox" 
                            checked={createExamStrictTabs}
                            onChange={(e) => setCreateExamStrictTabs(e.target.checked)}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="logic-switch-row">
                        <div className="logic-label-col">
                          <span className="logic-title">Randomize Order</span>
                          <span className="logic-desc">Prevent neighbor copying</span>
                        </div>
                        <label className="switch-input-wrapper">
                          <input 
                            type="checkbox" 
                            checked={createExamRandomizeQuestions}
                            onChange={(e) => setCreateExamRandomizeQuestions(e.target.checked)}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="logic-switch-row">
                        <div className="logic-label-col">
                          <span className="logic-title">Enable Calculator</span>
                          <span className="logic-desc">Scientific on-screen widget</span>
                        </div>
                        <label className="switch-input-wrapper">
                          <input 
                            type="checkbox" 
                            checked={createExamEnableCalculator}
                            onChange={(e) => setCreateExamEnableCalculator(e.target.checked)}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="creator-form-group" style={{ marginTop: '24px', marginBottom: 0 }}>
                        <label>Total Exam Weighting</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="number" 
                            value={createExamTotalMarks}
                            onChange={(e) => setCreateExamTotalMarks(parseInt(e.target.value))}
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontWeight: 700, color: '#475569' }}>%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: SETTINGS (General Configurations) */}
          {activeTab === 'settings' && !selectedUser && (
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
                    style={{ padding: '12px 24px', backgroundColor: '#2b7cff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
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
                  value={currentExam.id}
                  style={{ flex: 1, padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', backgroundColor: '#F8FAFC' }}
                />
                <button
                  onClick={() => copyToClipboard(currentExam.id)}
                  style={{
                    padding: '10px 16px', backgroundColor: copied ? '#059669' : '#2b7cff',
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

    </div>
  )
}
