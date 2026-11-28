import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LuCheck, LuCopy, LuTv } from 'react-icons/lu';
import './exam-builder/ExamBuilder.css';
import { Button, Card, Skeleton } from '../components/ui';
import Modal from '../components/Modal';
import { useNow } from '../components/useNow';
import { useData } from '../data/useData';
import { getExamForEdit, newExam, newQuestion, saveExam } from '../data/examBuilder';
import { newId, questionIssues } from '../utils/questionFormat';
import { ADMIN_V2_BASE } from '../layout/navItems';
import BuilderTopBar from './exam-builder/BuilderTopBar';
import QuestionList from './exam-builder/QuestionList';
import QuestionEditor from './exam-builder/QuestionEditor';
import SettingsPanel from './exam-builder/SettingsPanel';
import AiGenerateModal from './exam-builder/AiGenerateModal';
import JsonImportModal from './exam-builder/JsonImportModal';
import BankPickerModal from './question-bank/BankPickerModal';
import { useToast } from '../components/toast/toastContext';

function Builder({ initial }) {
  const navigate = useNavigate();
  const now = useNow(5000);

  const location = useLocation();
  const toast = useToast();
  // Questions sent from the Question Bank ("Add to exam") arrive in router state.
  const incoming = location.state?.addQuestions;

  const { questions: initialQuestions, ...initialExam } = initial;
  const [exam, setExam] = useState(initialExam);
  const [questions, setQuestions] = useState(() => [...initialQuestions, ...(incoming || [])]);
  const [selectedId, setSelectedId] = useState(() => incoming?.[0]?.id ?? initialQuestions[0]?.id ?? null);
  const [dirty, setDirty] = useState(Boolean(incoming?.length));
  const [bankOpen, setBankOpen] = useState(false);

  useEffect(() => {
    if (!incoming?.length) return;
    toast({ message: `${incoming.length} questions added from the Question Bank. Review, then save.` });
    // Clear the router state so a refresh doesn't add them twice.
    navigate(location.pathname, { replace: true, state: null });
  }, [incoming, location.pathname, navigate, toast]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(initial.id ? Date.now() : null);
  const [showIssues, setShowIssues] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const touch = () => setDirty(true);

  const updateExam = (patch) => {
    setExam((e) => ({ ...e, ...patch }));
    touch();
  };

  const updateQuestion = useCallback((id, patch) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    setDirty(true);
  }, []);

  const addQuestion = (type) => {
    const q = newQuestion(type);
    setQuestions((qs) => [...qs, q]);
    setSelectedId(q.id);
    touch();
  };

  const addMany = (list, mode) => {
    setQuestions((qs) => (mode === 'replace' ? list : [...qs, ...list]));
    setSelectedId(list[0]?.id ?? null);
    touch();
  };

  const moveQuestion = (id, dir) => {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  };

  const reorder = (dragId, targetId) => {
    setQuestions((qs) => {
      const from = qs.findIndex((q) => q.id === dragId);
      const to = qs.findIndex((q) => q.id === targetId);
      if (from < 0 || to < 0) return qs;
      const next = [...qs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    touch();
  };

  const duplicateQuestion = (id) => {
    const i = questions.findIndex((q) => q.id === id);
    if (i < 0) return;
    const copy = { ...questions[i], id: newId(), options: [...questions[i].options] };
    setQuestions((qs) => [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)]);
    setSelectedId(copy.id);
    touch();
  };

  const deleteQuestion = (id) => {
    const i = questions.findIndex((q) => q.id === id);
    const q = questions[i];
    const hasContent = q && (q.text.trim() || q.options.some((o) => o.trim()) || q.expected.trim());
    if (hasContent && !window.confirm('Delete this question?')) return;
    const rest = questions.filter((x) => x.id !== id);
    setQuestions(rest);
    setSelectedId(rest[Math.min(i, rest.length - 1)]?.id ?? null);
    touch();
  };

  // Everything that blocks publishing, with a way to jump to it.
  const errors = useMemo(() => {
    if (!showIssues) return [];
    const list = [];
    if (!exam.title.trim()) list.push({ key: 'title', message: 'Add an exam title' });
    if (!(exam.duration_minutes >= 5)) list.push({ key: 'duration', message: 'Duration must be at least 5 minutes' });
    if (exam.schedule.mode === 'window' && (!exam.schedule.start_at || !exam.schedule.end_at || exam.schedule.end_at <= exam.schedule.start_at)) {
      list.push({ key: 'schedule', message: 'Fix the schedule window' });
    }
    if (!questions.length) list.push({ key: 'none', message: 'Add at least one question' });
    questions.forEach((q, i) => {
      const issues = questionIssues(q);
      if (issues.length) list.push({ key: q.id, message: `Question ${i + 1}: ${issues[0]}`, onGo: () => setSelectedId(q.id) });
    });
    return list;
  }, [showIssues, exam, questions]);

  const hasBlockingIssues = () => {
    const anyQuestion = questions.some((q) => questionIssues(q).length);
    const badWindow =
      exam.schedule.mode === 'window' && (!exam.schedule.start_at || !exam.schedule.end_at || exam.schedule.end_at <= exam.schedule.start_at);
    return !exam.title.trim() || !(exam.duration_minutes >= 5) || badWindow || !questions.length || anyQuestion;
  };

  const persist = async (status) => {
    setSaving(true);
    try {
      const saved = await saveExam({ ...exam, status, questions });
      const { questions: _savedQuestions, ...rest } = saved;
      setExam(rest);
      setDirty(false);
      setSavedAt(Date.now());
      return saved;
    } finally {
      setSaving(false);
    }
  };

  const onSaveDraft = () => persist(exam.status === 'published' ? 'published' : 'draft');

  const onPublish = async () => {
    setShowIssues(true);
    if (hasBlockingIssues()) {
      const firstBad = questions.find((q) => questionIssues(q).length);
      if (firstBad) setSelectedId(firstBad.id);
      return;
    }
    await persist('published');
    setPublished(true);
  };

  const onBack = () => !dirty || window.confirm('You have unsaved changes. Leave without saving?');

  const selectedIndex = questions.findIndex((q) => q.id === selectedId);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(exam.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="v2-builder">
      <BuilderTopBar
        exam={exam}
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        now={now}
        errors={errors}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        onBack={onBack}
      />

      <div className="v2-builder__panes">
        <Card className="v2-builder__pane v2-builder__pane--list">
          <QuestionList
            questions={questions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addQuestion}
            onReorder={reorder}
            onOpenAi={() => setAiOpen(true)}
            onOpenJson={() => setJsonOpen(true)}
            onOpenBank={() => setBankOpen(true)}
            showIssues={showIssues}
          />
        </Card>

        <Card className="v2-builder__pane v2-builder__pane--editor">
          <QuestionEditor
            question={questions[selectedIndex]}
            index={selectedIndex}
            total={questions.length}
            onChange={updateQuestion}
            onMove={moveQuestion}
            onDuplicate={duplicateQuestion}
            onDelete={deleteQuestion}
            showIssues={showIssues}
            emptyProps={{ onAdd: addQuestion, onOpenAi: () => setAiOpen(true), onOpenJson: () => setJsonOpen(true), onOpenBank: () => setBankOpen(true) }}
          />
        </Card>

        <Card className="v2-builder__pane v2-builder__pane--settings">
          <SettingsPanel exam={exam} onChange={updateExam} showIssues={showIssues} />
        </Card>
      </div>

      <AiGenerateModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        hasQuestions={questions.length > 0}
        defaultTopic={exam.subject}
        onGenerated={(list, mode) => {
          addMany(list, mode);
          setAiOpen(false);
        }}
      />
      <BankPickerModal
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        defaultSubject={exam.subject}
        onAdd={(list) => {
          addMany(list, 'append');
          setBankOpen(false);
          toast({ message: `${list.length} ${list.length === 1 ? 'question' : 'questions'} added from the bank` });
        }}
      />
      <JsonImportModal
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        hasQuestions={questions.length > 0}
        onImported={(list, mode) => {
          addMany(list, mode);
          setJsonOpen(false);
        }}
      />

      <Modal
        open={published}
        onClose={() => setPublished(false)}
        width={460}
        title="Exam published"
        description={`${exam.title} is live for ${exam.class_name}. Share this code so students can join.`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setPublished(false)}>
              Keep editing
            </Button>
            <Button size="sm" onClick={() => navigate(`${ADMIN_V2_BASE}/exams`)}>
              Back to Exams
            </Button>
          </>
        }
      >
        <div className="v2-code v2-code--large">
          <span className="v2-code__value">{exam.code}</span>
          <button type="button" className="v2-code__copy" onClick={copyCode}>
            {copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>
        <Link to={`${ADMIN_V2_BASE}/live-monitor`} className="v2-linkbtn v2-published__monitor">
          <LuTv aria-hidden="true" /> Open Live Monitor
        </Link>
      </Modal>
    </div>
  );
}

/** /v2/admin/exams/new and /v2/admin/exams/:id/edit */
export default function ExamBuilder() {
  const { id } = useParams();
  const editing = useData(getExamForEdit, id ?? null);

  if (!id) return <Builder key="new" initial={newExam()} />;

  if (editing.loading) {
    return (
      <div className="v2-builder">
        <Skeleton height={88} style={{ borderRadius: 16 }} />
        <div className="v2-builder__panes">
          <Skeleton height={480} style={{ borderRadius: 16 }} />
          <Skeleton height={480} style={{ borderRadius: 16 }} />
          <Skeleton height={480} style={{ borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (!editing.data) {
    return (
      <Card style={{ padding: 'var(--space-8)' }}>
        <h1 className="h2">Exam not found</h1>
        <p className="body-2 text-secondary">It may have been deleted.</p>
        <Link to={`${ADMIN_V2_BASE}/exams`} className="v2-backlink">
          Back to Exams
        </Link>
      </Card>
    );
  }

  return <Builder key={id} initial={editing.data} />;
}
