import './dashboard/Dashboard.css';
import DashboardHeader from './dashboard/DashboardHeader';
import StatCards from './dashboard/StatCards';
import AttendanceChart from './dashboard/AttendanceChart';
import LiveExams from './dashboard/LiveExams';
import InsightCards from './dashboard/InsightCards';
import UpcomingExams from './dashboard/UpcomingExams';
import ResultOverview from './dashboard/ResultOverview';

export default function Dashboard() {
  return (
    <div className="v2-dashboard">
      <DashboardHeader />

      <div className="v2-dashboard__row v2-dashboard__row--top">
        <div className="v2-dashboard__col">
          <StatCards />
          <AttendanceChart />
        </div>
        <div className="v2-dashboard__col">
          <LiveExams />
          <InsightCards />
        </div>
      </div>

      <div className="v2-dashboard__row v2-dashboard__row--bottom">
        <UpcomingExams />
        <ResultOverview />
      </div>
    </div>
  );
}
