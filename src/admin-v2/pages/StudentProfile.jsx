import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './student-profile/StudentProfile.css';
import { Card, Skeleton } from '../components/ui';
import Drawer from '../components/Drawer';
import { useData } from '../data/useData';
import { getStudentProfile, listStudentAttempts } from '../data/studentProfile';
import { setReview } from '../data/reviewStore';
import { downloadAnswerSheet, downloadStudentReport } from '../utils/pdf';
import { ADMIN_V2_BASE } from '../layout/navItems';
import ProfileHeader from './student-profile/ProfileHeader';
import ProfileStats from './student-profile/ProfileStats';
import IntegritySummary from './student-profile/IntegritySummary';
import ScoreIntegrityChart from './student-profile/ScoreIntegrityChart';
import ExamHistory from './student-profile/ExamHistory';
import AttemptReview from './student-profile/AttemptReview';
import { summarize } from './student-profile/summary';

export default function StudentProfile() {
  const { id } = useParams();
  const profile = useData(getStudentProfile, id);
  const attemptsQ = useData(listStudentAttempts, id);

  // Verdicts saved on this page (also written to the shared review store).
  const [reviews, setReviews] = useState({});
  const [reviewId, setReviewId] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const attempts = useMemo(
    () => (attemptsQ.data || []).map((a) => (reviews[a.id] ? { ...a, review: reviews[a.id] } : a)),
    [attemptsQ.data, reviews],
  );
  const summary = useMemo(() => summarize(attempts), [attempts]);
  const reviewing = attempts.find((a) => a.id === reviewId) || null;
  const student = profile.data;

  const runDownload = async (key, fn) => {
    setDownloading(key);
    try {
      await fn();
    } finally {
      setDownloading(null);
    }
  };

  if (profile.loading || attemptsQ.loading) {
    return (
      <div className="v2-profile">
        <Skeleton height={150} style={{ borderRadius: 16 }} />
        <div className="v2-stats v2-stats--4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={112} style={{ borderRadius: 16 }} />
          ))}
        </div>
        <Skeleton height={360} style={{ borderRadius: 16 }} />
      </div>
    );
  }

  if (!student) {
    return (
      <Card className="v2-profile-missing">
        <h1 className="h2">Student not found</h1>
        <p className="body-2 text-secondary">This student may have been removed.</p>
        <Link to={`${ADMIN_V2_BASE}/students`} className="v2-backlink">
          Back to Students
        </Link>
      </Card>
    );
  }

  return (
    <div className="v2-profile">
      <ProfileHeader
        student={student}
        downloading={downloading === 'report'}
        onDownloadReport={() => runDownload('report', () => downloadStudentReport(student, attempts, summary))}
      />

      <ProfileStats attempts={attempts} summary={summary} />

      <div className="v2-profile__grid">
        <IntegritySummary summary={summary} />
        <ScoreIntegrityChart attempts={attempts} />
      </div>

      <ExamHistory
        attempts={attempts}
        onReview={setReviewId}
        downloadingId={downloading}
        onDownload={(a) => runDownload(a.id, () => downloadAnswerSheet(student, a))}
      />

      <Drawer open={Boolean(reviewing)} onClose={() => setReviewId(null)} label="Attempt review" width={1080}>
        <AttemptReview
          key={reviewId}
          attempt={reviewing}
          onClose={() => setReviewId(null)}
          downloading={downloading === reviewId}
          onDownload={(a) => runDownload(a.id, () => downloadAnswerSheet(student, a))}
          onSaveReview={(attemptId, review) => {
            setReview(attemptId, review);
            setReviews((r) => ({ ...r, [attemptId]: review }));
          }}
        />
      </Drawer>
    </div>
  );
}
