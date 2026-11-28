import { useNavigate } from 'react-router-dom';
import { LuPlus } from 'react-icons/lu';
import { Button } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import { ADMIN_V2_BASE } from '../../layout/navItems';
import NotificationBell from '../../components/notifications/NotificationBell';

export default function ExamsHeader({ search, onSearch }) {
  const navigate = useNavigate();
  return (
    <PageHeader title="Manage Exams" showDate search={search} onSearch={onSearch}>
      <NotificationBell />
      <Button onClick={() => navigate(`${ADMIN_V2_BASE}/exams/new`)}>
        <LuPlus aria-hidden="true" /> Add New Exam
      </Button>
    </PageHeader>
  );
}
