import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

// Pages
import Login from "./Pages/Login";
import AdminDashboard from "./Pages/AdminDashboard";
import CreateExam from "./Pages/CreateExam";
import ExamIntro from "./Pages/ExamIntro";
import ExamAttempt from "./Pages/ExamAttempt";
import ExamBlocked from "./Pages/ExamBlocked";
import ExamStatusCheck from "./Components/ExamStatusCheck";
import Examdone from "./Pages/Examdone";
import ExamRedirect from "./Pages/ExamRedirect";
import Examcode from "./Pages/Examcode";
import LiveMonitoring from "./Components/LiveMonitoring";
import { ExamActivityProvider } from "./context/ExamActivityProvider";
import Diagnostics from "./Pages/Diagnostics";
import Loader from "./Components/common/Loader";

/**
 * Route protection wrapper:
 * - Shows loading state during initial session & role discovery
 * - Preserves requested location URL if unauthenticated
 * - Restricts access to role-gated routes
 */
function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader fullPage message="Authenticating session..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === "admin" ? "/admin" : "/examcode"} replace />;
  }

  return children;
}

function App() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <Loader fullPage message="Loading application..." />;
  }

  return (
    <ExamActivityProvider enabled={role === "admin"}>
    <Routes>
      {/* Public / Authentication Route */}
      <Route path="/login" element={<Login />} />

      {/* Common Exam Routes (Accessible by authenticated users) */}
      <Route
        path="/exam/:id"
        element={
          <ProtectedRoute>
            <ExamStatusCheck />
          </ProtectedRoute>
        }
      >
        <Route index element={<ExamIntro />} />
        <Route path="attempt" element={<ExamAttempt />} />
        <Route path="blocked" element={<ExamBlocked />} />
      </Route>

      <Route
        path="/exam/attempt/:id"
        element={
          <ProtectedRoute>
            <ExamAttempt />
          </ProtectedRoute>
        }
      />

      <Route
        path="/exam-redirect"
        element={
          <ProtectedRoute>
            <ExamRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam-redirect/:id"
        element={
          <ProtectedRoute>
            <ExamRedirect />
          </ProtectedRoute>
        }
      />

      <Route
        path="/examdone"
        element={
          <ProtectedRoute>
            <Examdone />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/:examId/done"
        element={
          <ProtectedRoute>
            <Examdone />
          </ProtectedRoute>
        }
      />

      {/* Admin Protected Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/monitor/:examId"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/monitor/:examId"
        element={
          <ProtectedRoute requiredRole="admin">
            <LiveMonitoring />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-exam"
        element={
          <ProtectedRoute requiredRole="admin">
            <CreateExam />
          </ProtectedRoute>
        }
      />

      {/* Student Protected Routes */}
      <Route
        path="/examcode"
        element={
          <ProtectedRoute requiredRole="student">
            <Examcode />
          </ProtectedRoute>
        }
      />
      <Route
        path="/diagnostics/:examCode"
        element={
          <ProtectedRoute requiredRole="student">
            <Diagnostics />
          </ProtectedRoute>
        }
      />
      <Route path="/exam" element={<Navigate to="/examcode" replace />} />

      {/* Root & Catch-all Fallbacks */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={role === "admin" ? "/admin" : "/examcode"} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          user ? (
            <Navigate to={role === "admin" ? "/admin" : "/examcode"} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
    </ExamActivityProvider>
  );
}

export default App;
