/**
 * Issue #4 — ONE admin Realtime channel for exam activity.
 *
 * Design (one admin tab -> one channel, never one channel per student):
 *
 *   supabase.channel("admin-exam-activity")
 *        ├── postgres_changes INSERT on public.exam_logs
 *        └── postgres_changes INSERT on public.exam_flags
 *
 * The hook owns:
 *   - channel creation/cleanup (StrictMode safe, single instance)
 *   - event normalization into one UI-friendly shape
 *   - composite deduplication (`exam_logs:<id>` / `exam_flags:<id>`)
 *   - a bounded 200-event in-memory buffer
 *   - connection status
 *   - bounded resync after (re)connect
 *
 * The database stays the source of truth; Realtime is only the delivery
 * mechanism and the buffer is only the live UI window.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../SupabaseClient";

export const ADMIN_ACTIVITY_CHANNEL = "admin-exam-activity";
export const MAX_EVENTS = 200;
const RESYNC_LIMIT = 100;
const TOPIC_PREFIX = "realtime:";

/** Normalize an `exam_logs` row into the shared activity shape. */
export function normalizeExamLog(row, deliveredBy = "realtime") {
  if (!row || row.id == null) return null;
  const createdAt = row.created_at ?? row.timestamp ?? null;
  const details = row.event_details || {};
  return {
    id: row.id,
    source: "exam_logs",
    dedupeKey: `exam_logs:${row.id}`,
    eventType: row.event_type ?? "ACTIVITY",
    type: row.event_type ?? "ACTIVITY",
    examId: row.exam_id ?? details.exam_id ?? null,
    examAttemptId: row.exam_attempt_id ?? null,
    studentId: row.student_id ?? null,
    userName: row.user_name ?? null,
    createdAt,
    timestamp: createdAt,
    isFlag: false,
    deliveredBy,
    // UI-compat fields used by the existing AdminDashboard / LiveMonitoring JSX
    user_id: row.student_id ?? null,
    student_id: row.student_id ?? null,
    exam_attempt_id: row.exam_attempt_id ?? null,
    flag_type: row.event_type ?? "ACTIVITY",
    event_type: row.event_type ?? "ACTIVITY",
    created_at: createdAt,
    message: details.message || null,
    payload: details,
    event_details: details,
    raw: row,
  };
}

/** Normalize an `exam_flags` row into the shared activity shape. */
export function normalizeExamFlag(row, deliveredBy = "realtime") {
  if (!row || row.id == null) return null;
  const createdAt = row.timestamp ?? row.created_at ?? null;
  return {
    id: row.id,
    source: "exam_flags",
    dedupeKey: `exam_flags:${row.id}`,
    eventType: row.flag_type ?? "FLAG",
    type: row.flag_type ?? "FLAG",
    examId: row.exam_id ?? null,
    examAttemptId: row.exam_attempt_id ?? null,
    studentId: row.user_id ?? null,
    userName: row.user_name ?? null,
    createdAt,
    timestamp: createdAt,
    isFlag: true,
    deliveredBy,
    user_id: row.user_id ?? null,
    student_id: row.user_id ?? null,
    exam_attempt_id: row.exam_attempt_id ?? null,
    flag_type: row.flag_type ?? "FLAG",
    event_type: row.flag_type ?? "FLAG",
    created_at: createdAt,
    message: `Anomaly Detected: ${row.flag_type ?? "FLAG"}`,
    payload: row.metadata || {},
    event_details: row.metadata || {},
    raw: row,
  };
}

const timeOf = (event) => new Date(event?.createdAt || event?.timestamp || 0).getTime();

export default function useRealtimeExamActivity({ enabled = true } = {}) {
  const [events, setEvents] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState(enabled ? "CONNECTING" : "DISABLED");

  const channelRef = useRef(null);
  const seenRef = useRef(new Set());
  const resyncingRef = useRef(false);
  const enabledRef = useRef(enabled);

  enabledRef.current = enabled;

  const addEvents = useCallback((incoming) => {
    const rows = (incoming || []).filter((row) => row && row.dedupeKey);
    if (rows.length === 0) return;

    setEvents((prev) => {
      const merged = [...prev];
      let changed = false;

      for (const row of rows) {
        if (seenRef.current.has(row.dedupeKey)) continue;
        seenRef.current.add(row.dedupeKey);
        merged.push(row);
        changed = true;
      }

      if (!changed) return prev;

      // Newest first, bounded to MAX_EVENTS.
      merged.sort((a, b) => timeOf(b) - timeOf(a));
      const trimmed = merged.length > MAX_EVENTS ? merged.slice(0, MAX_EVENTS) : merged;

      // Keep the dedupe set aligned with the bounded buffer.
      seenRef.current = new Set(trimmed.map((e) => e.dedupeKey));
      return trimmed;
    });
  }, []);

  const resync = useCallback(async () => {
    if (resyncingRef.current) return;
    resyncingRef.current = true;
    try {
      const [logsResult, flagsResult] = await Promise.all([
        supabase
          .from("exam_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(RESYNC_LIMIT),
        supabase
          .from("exam_flags")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(RESYNC_LIMIT),
      ]);

      const normalized = [];
      if (!logsResult.error && logsResult.data) {
        normalized.push(...logsResult.data.map((r) => normalizeExamLog(r, "resync")).filter(Boolean));
      }
      if (!flagsResult.error && flagsResult.data) {
        normalized.push(...flagsResult.data.map((r) => normalizeExamFlag(r, "resync")).filter(Boolean));
      }
      addEvents(normalized);
    } catch (err) {
      console.warn("[useRealtimeExamActivity] Resync failed:", err);
    } finally {
      resyncingRef.current = false;
    }
  }, [addEvents]);

  useEffect(() => {
    if (!enabled) {
      setConnectionStatus("DISABLED");
      return undefined;
    }

    // Defensive: drop any stale channel with our topic (StrictMode remounts,
    // hot reload, or a previous dashboard instance).
    const existing = supabase.getChannels?.() || [];
    existing.forEach((ch) => {
      const topic = ch?.topic || "";
      if (topic === ADMIN_ACTIVITY_CHANNEL || topic === `${TOPIC_PREFIX}${ADMIN_ACTIVITY_CHANNEL}`) {
        supabase.removeChannel(ch);
      }
    });

    setConnectionStatus("CONNECTING");

    const channel = supabase
      .channel(ADMIN_ACTIVITY_CHANNEL)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "exam_logs" },
        (payload) => {
          const row = normalizeExamLog(payload?.new);
          if (row) addEvents([row]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "exam_flags" },
        (payload) => {
          const row = normalizeExamFlag(payload?.new);
          if (row) addEvents([row]);
        }
      )
      .subscribe((status) => {
        if (!enabledRef.current) return;
        setConnectionStatus(status);
        if (status === "SUBSCRIBED") {
          // Realtime does not replay missed events, so reconcile on (re)connect.
          resync();
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, addEvents, resync]);

  return { events, connectionStatus, resync };
}
