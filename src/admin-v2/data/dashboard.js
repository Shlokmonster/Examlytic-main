/**
 * Admin v2 dashboard data layer.
 *
 * Components only call these async functions. Right now they return mock
 * data. Later each function body gets replaced with real Supabase queries
 * (see the old src/Pages/AdminDashboard.jsx) without touching the components.
 */

export const USE_MOCKS = true;

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDashboardStats() {
  await delay();
  return {
    ongoingExams: 3,
    overallEnroll: { candidates: 127, changePct: 7.2 },
    overallPassRate: { passedPct: 73, changePct: -4.8 },
  };
}

export async function getAttendanceVsPass(/* period = 'monthly' */) {
  await delay();
  return {
    avgPassingRate: 69,
    months: [
      { label: 'Jan', attended: 140, passed: 105 },
      { label: 'Feb', attended: 205, passed: 125 },
      { label: 'Mar', attended: 140, passed: 115 },
      { label: 'Apr', attended: 135, passed: 105 },
      { label: 'May', attended: 330, passed: 165 },
      { label: 'Jun', attended: 395, passed: 215 },
      { label: 'Jul', attended: 440, passed: 290 },
      { label: 'Aug', attended: 253, passed: 198 },
      { label: 'Sep', attended: 175, passed: 125 },
      { label: 'Oct', attended: 160, passed: 105 },
      { label: 'Nov', attended: 225, passed: 160 },
      { label: 'Dec', attended: 270, passed: 160 },
    ],
  };
}

export async function getLiveExams() {
  await delay();
  return [
    {
      id: 'live-1',
      title: 'Physics - Class 10 Final Test.',
      subject: 'physics',
      startTime: '9.00 AM',
      endTime: '1.00 PM',
      students: 120,
      minutesLeft: 43,
      totalMinutes: 240,
    },
    {
      id: 'live-2',
      title: 'Chemistry - Class 9 Final Test.',
      subject: 'chemistry',
      startTime: '9.00 AM',
      endTime: '1.00 PM',
      students: 120,
      minutesLeft: 83,
      totalMinutes: 240,
    },
    {
      id: 'live-3',
      title: 'Math - Class 8 Unit Test.',
      subject: 'math',
      startTime: '10.00 AM',
      endTime: '12.00 PM',
      students: 96,
      minutesLeft: 25,
      totalMinutes: 120,
    },
  ];
}

export async function getInsights() {
  await delay();
  return {
    questions: { mostSkipped: 3, mostSkippedSubject: 'Math', skipRate: 71, skipRateChange: 3.7 },
    proctoring: { cheatingDetected: 7 },
  };
}

export async function getUpcomingExams(/* { type, search, range } */) {
  await delay();
  return [
    { id: 'u1', type: 'mcq', exam: 'Midterm', className: '10', subject: 'Physics', startTime: '10.00 am', duration: 120, candidates: 65, timeLeft: { value: 1, unit: 'Days' } },
    { id: 'u2', type: 'mcq', exam: 'Midterm', className: '08', subject: 'Math', startTime: '10.00 am', duration: 120, candidates: 65, timeLeft: { value: 3, unit: 'Days' } },
    { id: 'u3', type: 'mcq', exam: 'Midterm', className: '08', subject: 'English', startTime: '10.00 am', duration: 120, candidates: 65, timeLeft: { value: 5, unit: 'Days' } },
    { id: 'u4', type: 'mcq', exam: 'Midterm', className: '08', subject: 'Bangla', startTime: '10.00 am', duration: 120, candidates: 65, timeLeft: { value: 2, unit: 'Days' } },
    { id: 'u5', type: 'mcq', exam: 'Midterm', className: '09', subject: 'Chemistry', startTime: '10.00 am', duration: 120, candidates: 65, timeLeft: { value: 5, unit: 'Hours' } },
    { id: 'u6', type: 'written', exam: 'Final', className: '10', subject: 'History', startTime: '11.00 am', duration: 90, candidates: 58, timeLeft: { value: 4, unit: 'Days' } },
    { id: 'u7', type: 'written', exam: 'Midterm', className: '09', subject: 'Biology', startTime: '09.30 am', duration: 120, candidates: 61, timeLeft: { value: 6, unit: 'Days' } },
    { id: 'u8', type: 'viva', exam: 'Oral', className: '10', subject: 'English', startTime: '02.00 pm', duration: 30, candidates: 40, timeLeft: { value: 2, unit: 'Days' } },
  ];
}

export async function getResultOverview() {
  await delay();
  return {
    averageCgpa: 4.65,
    cgpaChange: 4.7,
    totalStudents: 231,
    top: { pct: 35, students: 65 },
    average: { pct: 45, students: 147 },
    fail: { pct: 20, students: 19 },
  };
}
