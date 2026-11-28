/**
 * Admin v2 Results & Analytics data layer (mock for now).
 * Replace function bodies with Supabase queries later; the components stay the same.
 */

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getResultStats() {
  await delay();
  return {
    averageScore: { pct: 78.5, changePct: 3.7 },
    highestScore: { pct: 98, changePct: 1.5 },
    examsAnalyzed: { value: 320, changePct: 1.5 },
    averageTime: { hours: 2, minutes: 25, changePct: 1.5 },
    topPerformer: { score: 97, outOf: 100, name: 'Lukas Shen' },
  };
}

// Score band per cell (0: 0–40, 1: 40–60, 2: 60–80, 3: 80–100), from the reference.
const HEAT_LEVELS = {
  Physics: [0, 0, 0, 2, 3, 2, 0, 0, 2],
  Mathematics: [0, 2, 2, 2, 3, 2, 2, 0, 0],
  Biology: [0, 1, 2, 2, 3, 3, 2, 2, 0],
  Geography: [0, 1, 2, 3, 3, 3, 2, 2, 0],
  Chemistry: [0, 1, 2, 2, 3, 2, 2, 2, 0],
  Bangla: [1, 1, 2, 2, 3, 2, 2, 2, 1],
  English: [1, 1, 2, 3, 3, 3, 2, 1, 1],
  Sports: [0, 1, 2, 3, 3, 2, 2, 1, 0],
  Arts: [2, 1, 2, 2, 3, 2, 2, 1, 0],
  ICT: [0, 2, 2, 2, 3, 2, 2, 1, 0],
};
const BAND_BASE = [28, 50, 68, 86];

const PERIOD_LABELS = {
  monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  weekly: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9'],
  yearly: ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
};

export async function getSubjectHeatmap(period = 'monthly') {
  await delay();
  return {
    columns: PERIOD_LABELS[period] || PERIOD_LABELS.monthly,
    rows: Object.entries(HEAT_LEVELS).map(([subject, levels]) => ({
      subject,
      scores: levels.map((lvl, i) => BAND_BASE[lvl] + ((i * 7 + subject.length) % 9)),
    })),
  };
}

export async function getAccelerationPlan(/* range = 'week' */) {
  await delay();
  return [
    { id: 'a1', priority: 'Urgent', focus: 'Math', status: '40% Scored > 50', actions: ['Peer Mentoring Groups'], impact: '+25% Avg Gain' },
    { id: 'a2', priority: 'High', focus: 'Physics', status: '72% preparation incomplete', actions: ['Cheat sheet', 'Key concept review'], impact: 'Reduce fail rate by 35%' },
    { id: 'a3', priority: 'Medium', focus: 'Biology', status: '40% scored <50%', actions: ['Promote 3+ attempts'], impact: '+15% completion' },
    { id: 'a4', priority: 'Low', focus: 'English', status: '75% correct answers', actions: ['Vocabulary sprint'], impact: '+7% mastery' },
  ];
}

export async function getQuestionLevels() {
  await delay();
  return [
    { key: 'easy', pct: 55, label: 'Easy to answer', correctPct: 75 },
    { key: 'difficult', pct: 30, label: 'Difficult to answer', correctPct: 51 },
    { key: 'hard', pct: 15, label: 'Hard to answer', correctPct: 25 },
  ];
}

export async function getConversion() {
  await delay();
  return { totalSignUps: 3212, changePct: 4.7, enrolled: 521, premium: 79 };
}

export async function getRecommendation() {
  await delay();
  return {
    subject: 'Chemistry',
    crisis: { avgScore: 59, studentsBelow50Pct: 40 },
    action: 'Add 2 Labs + 1 Workshop this week',
  };
}

export async function getAttemptGrowth() {
  await delay();
  return {
    // Smooth score curve sampled across the three attempts.
    curve: [56, 58, 63, 70, 72, 69, 66, 74, 92],
    attempts: [
      { label: 'Attempt(1)', index: 0, growthPct: null },
      { label: 'Attempt(2)', index: 4, growthPct: 27.7 },
      { label: 'Attempt(3)', index: 8, growthPct: 18.2 },
    ],
  };
}
