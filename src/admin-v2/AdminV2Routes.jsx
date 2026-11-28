import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import Exams from './pages/Exams';
import Results from './pages/Results';
import Students from './pages/Students';
import LiveMonitor from './pages/LiveMonitor';
import StudentProfile from './pages/StudentProfile';
import ExamBuilder from './pages/ExamBuilder';
import QuestionBank from './pages/QuestionBank';
import Settings from './pages/Settings';
import ReviewQueue from './pages/ReviewQueue';
import Help from './pages/Help';
import ComingSoon from './pages/ComingSoon';
import { ADMIN_V2_BASE, NAV_SECTIONS } from './layout/navItems';

/** Pages that are built. Every other nav item shows a "Coming soon" placeholder. */
const BUILT_PAGES = {
  exams: <Exams />,
  results: <Results />,
  students: <Students />,
  'live-monitor': <LiveMonitor />,
  'question-bank': <QuestionBank />,
  settings: <Settings />,
  reviews: <ReviewQueue />,
  help: <Help />,
};

const toPath = (to) => to.replace(`${ADMIN_V2_BASE}/`, '');
const placeholderPages = NAV_SECTIONS.flatMap((s) => s.items).filter(
  (item) => !item.end && !BUILT_PAGES[toPath(item.to)],
);

/** All routes under /v2/admin/*. Mounted from App.jsx behind the admin ProtectedRoute. */
export default function AdminV2Routes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        {Object.entries(BUILT_PAGES).map(([path, element]) => (
          <Route key={path} path={path} element={element} />
        ))}
        <Route path="students/:id" element={<StudentProfile />} />
        <Route path="exams/new" element={<ExamBuilder />} />
        <Route path="exams/:id/edit" element={<ExamBuilder />} />
        {placeholderPages.map((item) => (
          <Route key={item.to} path={toPath(item.to)} element={<ComingSoon title={item.label} />} />
        ))}
        <Route path="*" element={<Navigate to={ADMIN_V2_BASE} replace />} />
      </Route>
    </Routes>
  );
}
