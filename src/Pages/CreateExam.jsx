import { useState, useEffect } from "react"
import supabase from "../SupabaseClient"
import { useNavigate } from "react-router-dom"
import Navbar from "../Components/common/Navbar"

import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { generateExamQuestions } from "../utils/groqService"

// Sample JSON structure for reference
const SAMPLE_QUESTIONS = [
  {
    "question": "What is the capital of France?",
    "type": "mcq",
    "optionA": "London",
    "optionB": "Paris",
    "optionC": "Berlin",
    "optionD": "Madrid",
    "correct_answer": "B"
  },
  {
    "question": "Explain the concept of React hooks",
    "type": "answerable",
    "correct_answer": "React Hooks are functions that let you use state and other React features without writing classes."
  }
]

const styles = `
  .create-exam-container {
    max-width: 1000px;
    margin: 40px auto;
    padding: 0 24px 80px;
    font-family: 'Inter', sans-serif;
  }
  
  .exam-header {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    border-radius: 16px;
    padding: 32px 40px;
    margin-bottom: 32px;
    color: #ffffff;
    box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.1);
  }
  
  .exam-header h1 {
    font-size: 2rem;
    font-weight: 800;
    margin: 0 0 8px 0;
    letter-spacing: -0.02em;
  }
  
  .subtitle {
    font-size: 0.95rem;
    color: #A7F3D0;
    margin: 0;
    font-weight: 500;
  }
  
  .exam-card-wrapper {
    background: #ffffff;
    border: 1px solid #E2E8F0;
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
    margin-bottom: 28px;
  }
  
  .exam-card-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #111827;
    margin: 0 0 24px 0;
    border-bottom: 1.5px dashed #E2E8F0;
    padding-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .ai-generator-section {
    background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
    border-radius: 16px;
    padding: 32px;
    color: #ffffff;
    margin-bottom: 32px;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    position: relative;
    overflow: hidden;
  }
  
  .ai-generator-section h3 {
    font-size: 1.15rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .ai-input-group {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .ai-input-group input {
    flex: 1;
    background: #334155;
    border: 1px solid #475569;
    color: #ffffff;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.2s;
  }
  
  .ai-input-group input:focus {
    border-color: #059669;
    background: #1e293b;
  }
  
  .ai-input-group select {
    background: #334155;
    border: 1px solid #475569;
    color: #ffffff;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    outline: none;
    cursor: pointer;
  }
  
  .ai-generate-btn {
    background: #059669;
    color: #ffffff;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .ai-generate-btn:hover:not(:disabled) {
    background: #047857;
    transform: translateY(-1px);
  }
  
  .ai-generate-btn:disabled {
    background: #475569;
    cursor: not-allowed;
  }
  
  .ai-hint {
    font-size: 0.8rem;
    color: #94A3B8;
    margin: 12px 0 0 0;
  }
  
  .import-export-section {
    background: #ffffff;
    border: 1px solid #E2E8F0;
    border-radius: 16px;
    margin-bottom: 32px;
    overflow: hidden;
  }
  
  .import-header {
    background: #F8FAFC;
    padding: 20px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #E2E8F0;
  }
  
  .import-header h3 {
    font-size: 1rem;
    font-weight: 800;
    color: #1F2937;
    margin: 0;
  }
  
  .toggle-import-btn {
    background: transparent;
    border: 1px solid #D1D5DB;
    color: #4B5563;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .toggle-import-btn:hover {
    background: #F1F5F9;
  }
  
  .json-import-container {
    padding: 32px;
    background: #ffffff;
  }
  
  .json-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .json-textarea {
    width: 100%;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    padding: 16px;
    outline: none;
    transition: all 0.2s;
  }
  
  .json-textarea:focus {
    border-color: #059669;
    background: #ffffff;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .form-group label {
    font-size: 0.85rem;
    font-weight: 700;
    color: #374151;
  }
  
  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 12px 16px;
    border: 1.5px solid #E2E8F0;
    border-radius: 8px;
    font-size: 0.9rem;
    color: #1F2937;
    background: #ffffff;
    outline: none;
    transition: all 0.2s;
  }
  
  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.05);
  }
  
  .questions-section {
    margin-top: 32px;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #E2E8F0;
    padding-bottom: 16px;
    margin-bottom: 28px;
  }
  
  .section-header h3 {
    font-size: 1.15rem;
    font-weight: 800;
    color: #111827;
    margin: 0;
  }
  
  .question-count {
    background: #ECFDF5;
    color: #059669;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 12px;
  }
  
  .question-card {
    background: #ffffff;
    border: 1.5px solid #E2E8F0;
    border-radius: 16px;
    padding: 28px;
    margin-bottom: 28px;
    transition: all 0.2s;
  }
  
  .question-card:hover {
    border-color: #059669;
    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.02);
  }
  
  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .question-header h4 {
    font-size: 1rem;
    font-weight: 800;
    color: #111827;
    margin: 0;
  }
  
  .question-type-toggle {
    display: flex;
    background: #F1F5F9;
    padding: 4px;
    border-radius: 8px;
    gap: 4px;
    margin-bottom: 20px;
  }
  
  .toggle-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: #475569;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .toggle-btn.active {
    background: #ffffff;
    color: #059669;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  
  .mcq-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .option-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .option-radio {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .option-radio input[type="radio"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #059669;
  }
  
  .option-letter {
    font-size: 0.9rem;
    font-weight: 700;
    color: #6B7280;
  }
  
  .option-input {
    flex: 1;
    padding: 10px 14px;
    border: 1.5px solid #E2E8F0;
    border-radius: 8px;
    font-size: 0.875rem;
    outline: none;
    transition: all 0.2s;
  }
  
  .option-input:focus {
    border-color: #059669;
  }
  
  .btn-delete {
    background: #FEF2F2;
    border: 1px solid #FEE2E2;
    color: #EF4444;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-delete:hover {
    background: #EF4444;
    color: #ffffff;
  }
  
  .add-question-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 28px;
  }
  
  .btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
  }
  
  .btn-primary {
    background: #059669;
    color: #ffffff;
  }
  
  .btn-primary:hover {
    background: #047857;
  }
  
  .btn-outline {
    background: #ffffff;
    border: 1.5px solid #E2E8F0;
    color: #374151;
  }
  
  .btn-outline:hover {
    background: #F8FAFC;
    border-color: #D1D5DB;
  }
  
  .btn-text {
    background: transparent;
    color: #4B5563;
  }
  
  .btn-text:hover {
    color: #111827;
  }
  
  /* Toggle Switch Styles */
  .switch-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #F1F5F9;
  }
  
  .switch-row:last-child {
    border-bottom: none;
  }
  
  .switch-label-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .switch-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #1F2937;
  }
  
  .switch-desc {
    font-size: 0.75rem;
    color: #6B7280;
  }
  
  .switch-input-wrapper {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }
  
  .switch-input-wrapper input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .switch-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #E2E8F0;
    transition: .3s;
    border-radius: 24px;
  }
  
  .switch-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
  }
  
  input:checked + .switch-slider {
    background-color: #059669;
  }
  
  input:checked + .switch-slider:before {
    transform: translateX(20px);
  }
`

// Add styles to the document
const styleElement = document.createElement('style')
styleElement.textContent = styles
document.head.appendChild(styleElement)

export default function CreateExam() {
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [duration, setDuration] = useState(60)
  const [email, setEmail] = useState("")
  const [instructions, setInstructions] = useState("")
  const [questions, setQuestions] = useState([
    { question: "", type: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correct_answer: "A" },
  ])

  const navigate = useNavigate()
  const [showJsonInput, setShowJsonInput] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [aiTopic, setAiTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [numQuestions, setNumQuestions] = useState(5)
  const [webcamProctoring, setWebcamProctoring] = useState(true)
  const [strictTabs, setStrictTabs] = useState(true)
  const [randomizeQuestions, setRandomizeQuestions] = useState(false)
  const [enableCalculator, setEnableCalculator] = useState(false)
  const [totalMarks, setTotalMarks] = useState(100)

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", type: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correct_answer: "A" },
    ])
  }

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      showToast('Please enter a topic for question generation', 'error')
      return
    }

    setIsGenerating(true)
    try {
      const generatedQuestions = await generateExamQuestions(aiTopic, numQuestions)
      setQuestions(generatedQuestions)
      showToast(`Successfully generated ${generatedQuestions.length} questions`, 'success')
      setAiTopic('')
    } catch (error) {
      console.error('Error generating questions:', error)
      showToast(error.message || 'Failed to generate questions', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleJsonImport = () => {
    try {
      if (!jsonInput.trim()) {
        showToast('Please enter JSON data', 'error')
        return
      }
      
      const parsedQuestions = JSON.parse(jsonInput)
      if (!Array.isArray(parsedQuestions)) {
        throw new Error('JSON should be an array of questions')
      }

      // Validate each question
      const validatedQuestions = parsedQuestions.map((q, index) => {
        if (!q.question) {
          throw new Error(`Question at index ${index} is missing 'question' field`)
        }
        if (!q.type || !['mcq', 'answerable'].includes(q.type)) {
          throw new Error(`Question at index ${index} has invalid type. Must be 'mcq' or 'answerable'`)
        }
        if (q.type === 'mcq') {
          if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) {
            throw new Error(`MCQ question at index ${index} is missing options`)
          }
          if (!q.correct_answer || !['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
            throw new Error(`MCQ question at index ${index} has invalid correct answer`)
          }
        } else {
          if (!q.correct_answer) {
            throw new Error(`Answerable question at index ${index} is missing correct_answer`)
          }
        }
        return q
      })

      setQuestions(validatedQuestions)
      setShowJsonInput(false)
      setJsonInput('')
      showToast(`Successfully imported ${validatedQuestions.length} questions`, 'success')
    } catch (error) {
      console.error('Error parsing JSON:', error)
      showToast(`Invalid JSON: ${error.message}`, 'error')
    }
  }

  const handleQuestionChange = (i, field, value) => {
    const updated = [...questions]
    updated[i][field] = value
    setQuestions(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!title.trim()) {
      showToast('Please enter an exam title', 'error')
      return
    }

    if (questions.some(q => !q.question.trim())) {
      showToast('Please fill in all question fields', 'error')
      return
    }

    const user = await supabase.auth.getUser()
    const userId = user.data?.user?.id

    const config = {
      webcam_proctoring: webcamProctoring,
      strict_tabs: strictTabs,
      randomize_questions: randomizeQuestions,
      enable_calculator: enableCalculator,
      total_marks: totalMarks
    };
    const instructionsWithConfig = `${instructions}\n\n---CONFIG---\n${JSON.stringify(config)}`;

    const { error } = await supabase.from("exams").insert([
      {
        title,
        subject,
        duration_minutes: duration,
        support_email: email,
        instructions: instructionsWithConfig,
        questions,
        created_by: userId,
      },
    ])

    if (error) {
      showToast("Error: " + error.message, 'error')
    } else {
      showToast("Exam created successfully!", 'success')
      navigate("/admin/dashboard")
    }
  }

  // Toast notification configuration
  const showToast = (message, type = 'info') => {
    switch(type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      default:
        toast.info(message);
    }
  }

  return (
    <>
    <Navbar/>
    <div className="page-container">
      <div className="create-exam-container">
        <div className="exam-header">
          <h1>Create New Exam</h1>
          <p className="subtitle">Design and build your exam with advanced tools and AI assistance</p>
        </div>
        
        {/* AI Question Generator Section */}
        <div className="ai-generator-section">
          <h3> AI Question Generator</h3>
          <div className="ai-input-group">
            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Enter topic for AI to generate questions (e.g., JavaScript fundamentals, World History)"
            />
            <select 
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 10, 15, 20].map(num => (
                <option key={num} value={num}>{num} questions</option>
              ))}
            </select>
            <button 
              onClick={handleAiGenerate} 
              disabled={isGenerating}
              className="ai-generate-btn"
            >
              {isGenerating ? ' Generating...' : ' Generate Questions'}
            </button>
          </div>
          <p className="ai-hint">
             The AI will generate {numQuestions} high-quality questions about "{aiTopic || 'your topic'}"
          </p>
        </div>

        {/* Import/Export Section */}
        <div className="import-export-section">
          <div className="import-header">
            <h3>Import Questions</h3>
            <button 
              onClick={() => setShowJsonInput(!showJsonInput)}
              className="toggle-import-btn"
            >
              {showJsonInput ? 'Hide Import' : 'Show Import'}
            </button>
          </div>
          
          {showJsonInput && (
            <div className="json-import-container">
              <div className="json-actions">
                <button 
                  onClick={() => setJsonInput(JSON.stringify(SAMPLE_QUESTIONS, null, 2))}
                  className="btn btn-secondary"
                >
                  Load Sample
                </button>
                <button 
                  onClick={handleJsonImport}
                  className="btn btn-primary"
                >
                  Import Questions
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste your questions in JSON format here..."
                className="json-textarea"
                rows={10}
              />
              <div className="json-format-hint">
                <h4> JSON Format Guide</h4>
                <pre>
{`[
  {
    "question": "Your question here",
    "type": "mcq", // or "answerable"
    "optionA": "Option A",  // For MCQ only
    "optionB": "Option B",  // For MCQ only
    "optionC": "Option C",  // For MCQ only
    "optionD": "Option D",  // For MCQ only
    "correct_answer": "A"   // For MCQ: A/B/C/D, For answerable: string
  },
  // ... more questions
]`}
                </pre>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="exam-form">
          {/* Section 1: Exam Parameters */}
          <div className="exam-card-wrapper">
            <h3 className="exam-card-title">📝 Exam Parameters & Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Exam Title <span style={{ color: '#EF4444' }}>*</span></label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g., Midterm Exam - Computer Science 101"
                  required 
                />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input 
                  type="text" 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="e.g., Computer Science"
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Duration (minutes) <span style={{ color: '#EF4444' }}>*</span></label>
                <input 
                  type="number" 
                  value={duration} 
                  onChange={(e) => setDuration(e.target.value)} 
                  min="1" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Invite by Email (optional)</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="student@example.com"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Exam Instructions (optional)</label>
              <textarea 
                value={instructions} 
                onChange={(e) => setInstructions(e.target.value)} 
                placeholder="Enter any special instructions for the exam..."
                rows="3"
              />
            </div>
          </div>

          {/* Section 2: Proctoring & Security Configurations */}
          <div className="exam-card-wrapper">
            <h3 className="exam-card-title">🔒 Proctoring & Workspace Controls</h3>
            
            <div className="switch-row">
              <div className="switch-label-col">
                <span className="switch-title">AI Video Proctoring</span>
                <span className="switch-desc">Enforce student webcam feed and face monitoring anomalies.</span>
              </div>
              <label className="switch-input-wrapper">
                <input 
                  type="checkbox" 
                  checked={webcamProctoring} 
                  onChange={(e) => setWebcamProctoring(e.target.checked)} 
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            <div className="switch-row">
              <div className="switch-label-col">
                <span className="switch-title">Strict Tab Restrictions</span>
                <span className="switch-desc">Track and flag candidate tab switches and window blurred events.</span>
              </div>
              <label className="switch-input-wrapper">
                <input 
                  type="checkbox" 
                  checked={strictTabs} 
                  onChange={(e) => setStrictTabs(e.target.checked)} 
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            <div className="switch-row">
              <div className="switch-label-col">
                <span className="switch-title">Randomize Question Order</span>
                <span className="switch-desc">Shuffle test questions dynamically for each individual examinee.</span>
              </div>
              <label className="switch-input-wrapper">
                <input 
                  type="checkbox" 
                  checked={randomizeQuestions} 
                  onChange={(e) => setRandomizeQuestions(e.target.checked)} 
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            <div className="switch-row">
              <div className="switch-label-col">
                <span className="switch-title">Enable Calculator Tool</span>
                <span className="switch-desc">Display a floating scientific calculator widget in the student workspace.</span>
              </div>
              <label className="switch-input-wrapper">
                <input 
                  type="checkbox" 
                  checked={enableCalculator} 
                  onChange={(e) => setEnableCalculator(e.target.checked)} 
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '20px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Total Exam Weighting (marks)</label>
                <input 
                  type="number" 
                  value={totalMarks} 
                  onChange={(e) => setTotalMarks(parseInt(e.target.value))} 
                  min="1" 
                />
              </div>
            </div>
          </div>
          
          <div className="questions-section">
            <div className="section-header">
              <h3>Questions</h3>
              <span className="question-count">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="questions-list">
              {questions.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-inbox"></i>
                  <p>No questions added yet. Add your first question to get started.</p>
                </div>
              ) : (
                questions.map((q, i) => (
                  <div key={i} className="question-card">
                    <div className="question-header">
                      <h4>Question {i + 1}</h4>
                      {questions.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeQuestion(i)} 
                          className="btn-delete"
                        >
                           Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="question-type-toggle">
                      <button 
                        type="button" 
                        className={`toggle-btn ${q.type === 'mcq' ? 'active' : ''}`}
                        onClick={() => handleQuestionChange(i, 'type', 'mcq')}
                      >
                         Multiple Choice
                      </button>
                      <button 
                        type="button" 
                        className={`toggle-btn ${q.type === 'answerable' ? 'active' : ''}`}
                        onClick={() => handleQuestionChange(i, 'type', 'answerable')}
                      >
                        Written Answer
                      </button>
                    </div>

                    <div className="form-group">
                      <label>Question Text <span className="required">*</span></label>
                      <textarea
                        value={q.question}
                        onChange={(e) => handleQuestionChange(i, 'question', e.target.value)}
                        placeholder="Enter your question here..."
                        required
                        rows="3"
                      />
                    </div>

                    {q.type === 'mcq' ? (
                      <div className="mcq-options">
                        <label>Options <span className="required">*</span></label>
                        {['A', 'B', 'C', 'D'].map((opt) => (
                          <div key={opt} className="option-row">
                            <div className="option-radio">
                              <input
                                type="radio"
                                id={`q${i}-${opt}`}
                                name={`correct-${i}`}
                                checked={q.correct_answer === opt}
                                onChange={() => handleQuestionChange(i, 'correct_answer', opt)}
                              />
                              <span className="option-letter">{opt}.</span>
                            </div>
                            <input
                              type="text"
                              value={q[`option${opt}`] || ''}
                              onChange={(e) => handleQuestionChange(i, `option${opt}`, e.target.value)}
                              placeholder={`Option ${opt}`}
                              className="option-input"
                              required
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="answerable-field">
                        <label>Expected Answer <span className="required">*</span></label>
                        <textarea
                          value={q.correct_answer}
                          onChange={(e) => handleQuestionChange(i, 'correct_answer', e.target.value)}
                          placeholder="Enter the expected answer or key points..."
                          required
                          rows="4"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
              
              <div className="add-question-actions">
                <button 
                  type="button" 
                  onClick={addQuestion} 
                  className="btn btn-outline"
                >
                   Add Question
                </button>
                
                {questions.length > 0 && (
                  <div className="question-stats">
                    <span className="stat">
                      {questions.filter(q => q.type === 'mcq').length} Multiple Choice
                    </span>
                    <span className="stat">
                       {questions.filter(q => q.type === 'answerable').length} Written
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={() => window.history.back()} className="btn btn-text">
              ← Back
            </button>
            <div className="action-buttons">
              <button type="button" onClick={() => {
                showToast('Draft saved successfully', 'info');
              }} className="btn btn-outline">
                 Save as Draft
              </button>
              <button type="submit" className="btn btn-primary">
                Create Exam
              </button>
            </div>
          </div>
        </form>
        
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </div>
    </>
  );
}