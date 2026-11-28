/**
 * Admin v2 workspace settings (mock, in-memory).
 *
 * Backend phase: a `workspace_settings` row (institution name, logo url in
 * storage, timezone, support email, exam defaults, alert preferences) and an
 * `admin_members` table (user_id, role: owner | admin | proctor, invited_at).
 * The old app's Settings tab saved nothing (toast only), so this is new.
 */
const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

let SETTINGS = {
  general: {
    institution: 'Examlytic Academy',
    logo: null, // data URL in the mock; storage URL later
    timezone: 'Asia/Kolkata',
    support_email: 'exams@school.edu',
  },
  examDefaults: {
    duration_minutes: 60,
    webcam_proctoring: true,
    strict_tabs: true,
    availability: 'anytime', // 'anytime' | 'window'
  },
  alerts: {
    cooldown_seconds: 30,
    notify: { ai_flags: true, browser: true, disconnects: true, starting: true, submissions: false },
    sound: false,
    digest: 'daily', // 'off' | 'daily' | 'weekly'
  },
  team: [
    { id: 'm1', name: 'You', email: 'you@school.edu', role: 'owner', status: 'active' },
    { id: 'm2', name: 'Priya Nair', email: 'priya.nair@school.edu', role: 'admin', status: 'active' },
    { id: 'm3', name: 'Daniel Okafor', email: 'daniel.okafor@school.edu', role: 'proctor', status: 'active' },
  ],
};

const clone = (v) => JSON.parse(JSON.stringify(v));

export async function getSettings() {
  await delay(200);
  return clone(SETTINGS);
}

export async function saveSettings(next) {
  await delay();
  SETTINGS = clone(next);
  return clone(SETTINGS);
}

/** Synchronous read for places that need defaults immediately (e.g. a new exam). */
export const currentExamDefaults = () => clone(SETTINGS.examDefaults);
export const currentSupportEmail = () => SETTINGS.general.support_email;
