import { useState } from 'react';
import { LuDownload, LuUserPlus } from 'react-icons/lu';
import './students/Students.css';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui';
import StudentStats from './students/StudentStats';
import StudentsTable from './students/StudentsTable';
import IntegrityOverview from './students/IntegrityOverview';
import TopViolations from './students/TopViolations';
import TopPerformers from './students/TopPerformers';
import { listStudents } from '../data/students';
import { downloadCsv, STUDENT_CSV_COLUMNS } from '../utils/csv';
import NotificationBell from '../components/notifications/NotificationBell';

export default function Students() {
  const [search, setSearch] = useState('');

  const exportAll = async () => {
    const all = await listStudents();
    downloadCsv('students.csv', STUDENT_CSV_COLUMNS, all);
  };

  return (
    <div className="v2-students-page">
      <PageHeader
        title="Students"
        showDate
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by name, email or roll no..."
      >
        <NotificationBell />
        <Button variant="outline" onClick={exportAll} className="v2-students-page__export">
          <LuDownload aria-hidden="true" /> Export CSV
        </Button>
        <Button>
          Invite Students <LuUserPlus aria-hidden="true" />
        </Button>
      </PageHeader>

      <StudentStats />

      <div className="v2-students-page__grid">
        <StudentsTable search={search} />
        <aside className="v2-students-page__side">
          <IntegrityOverview />
          <TopViolations />
          <TopPerformers />
        </aside>
      </div>
    </div>
  );
}
