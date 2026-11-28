import {
  LuChartColumn,
  LuFileQuestion,
  LuHouse,
  LuInfo,
  LuPenTool,
  LuSettings,
  LuShieldCheck,
  LuTv,
  LuUserRound,
} from 'react-icons/lu';

export const ADMIN_V2_BASE = '/v2/admin';

export const NAV_SECTIONS = [
  {
    title: 'Main Menu',
    items: [
      { label: 'Dashboard', to: ADMIN_V2_BASE, icon: LuHouse, end: true },
      { label: 'Exams', to: `${ADMIN_V2_BASE}/exams`, icon: LuPenTool },
      { label: 'Students', to: `${ADMIN_V2_BASE}/students`, icon: LuUserRound },
      { label: 'Live Monitor', to: `${ADMIN_V2_BASE}/live-monitor`, icon: LuTv },
      { label: 'Question Bank', to: `${ADMIN_V2_BASE}/question-bank`, icon: LuFileQuestion },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Results & Analytics', to: `${ADMIN_V2_BASE}/results`, icon: LuChartColumn },
      { label: 'Review Queue', to: `${ADMIN_V2_BASE}/reviews`, icon: LuShieldCheck, badge: 'reviews' },
    ],
  },
  {
    title: 'Setting & Others',
    items: [
      { label: 'Setting', to: `${ADMIN_V2_BASE}/settings`, icon: LuSettings },
      { label: 'Help & Support', to: `${ADMIN_V2_BASE}/help`, icon: LuInfo },
    ],
  },
];
