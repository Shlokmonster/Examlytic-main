/**
 * Shared labels / categories / severities for proctoring events.
 * Keys are the real exam_flags.flag_type and exam_logs.event_type values.
 */
export const ALERT_TYPES = {
  NO_FACE_DETECTED: { label: 'No face detected', category: 'ai', severity: 'danger' },
  MULTIPLE_FACES_DETECTED: { label: 'Multiple faces detected', category: 'ai', severity: 'danger' },
  SUSPICIOUS_OBJECT_DETECTED: { label: 'Phone or book detected', category: 'ai', severity: 'danger' },
  LOOKING_AWAY: { label: 'Looking away', category: 'ai', severity: 'warning' },
  TAB_SWITCH: { label: 'Switched tab', category: 'browser', severity: 'warning' },
  FULLSCREEN_EXIT: { label: 'Exited fullscreen', category: 'browser', severity: 'warning' },
  SCREEN_SHARE_STOPPED: { label: 'Stopped screen share', category: 'browser', severity: 'danger' },
  COPY_CUT_PASTE: { label: 'Copy / paste attempt', category: 'browser', severity: 'warning' },
};

export const alertInfo = (type) => ALERT_TYPES[type] || { label: type, category: 'browser', severity: 'warning' };
