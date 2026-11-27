/**
 * Issue #4 — Shared admin exam-activity provider.
 *
 * Owns the single Realtime channel and shares the normalized, deduplicated,
 * bounded (200-event) activity buffer with every admin consumer:
 *
 *   ExamActivityProvider
 *        └── useRealtimeExamActivity  (ONE channel)
 *                ├── AdminDashboard
 *                └── LiveMonitoring  (also used standalone at /monitor/:examId)
 *
 * `enabled` is only true for the admin role so student sessions never open an
 * admin channel.
 */
import { createContext, useContext } from "react";
import useRealtimeExamActivity from "../hooks/useRealtimeExamActivity";

const EMPTY_ACTIVITY = {
  events: [],
  connectionStatus: "DISABLED",
  resync: async () => {},
};

const ExamActivityContext = createContext(EMPTY_ACTIVITY);

export function ExamActivityProvider({ children, enabled = true }) {
  const activity = useRealtimeExamActivity({ enabled });
  return (
    <ExamActivityContext.Provider value={activity}>
      {children}
    </ExamActivityContext.Provider>
  );
}

// The context consumer hook intentionally lives beside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useExamActivity() {
  return useContext(ExamActivityContext) || EMPTY_ACTIVITY;
}

export default ExamActivityContext;
