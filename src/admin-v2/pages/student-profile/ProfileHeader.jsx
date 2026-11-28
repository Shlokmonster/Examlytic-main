import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuChevronLeft, LuDownload, LuShieldAlert } from 'react-icons/lu';
import Avatar from '../../components/Avatar';
import { Button, Card } from '../../components/ui';
import { ADMIN_V2_BASE } from '../../layout/navItems';

const STATUS_LABEL = { live: 'Live in exam', active: 'Active', inactive: 'Inactive' };

const fmtDate = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', year: 'numeric' });

export default function ProfileHeader({ student, onDownloadReport, downloading }) {
  const [reported, setReported] = useState(false);

  return (
    <Card className="v2-profile-head">
      <Link to={`${ADMIN_V2_BASE}/students`} className="v2-backlink">
        <LuChevronLeft aria-hidden="true" /> Students
      </Link>

      <div className="v2-profile-head__row">
        <div className="v2-profile-head__id">
          <Avatar name={student.user_name} src={student.user_avatar} size={64} />
          <div>
            <h1 className="h2">{student.user_name}</h1>
            <p className="v2-profile-head__meta">
              <span className="v2-badge">{student.class_name}</span>
              <span>Roll {student.roll_no}</span>
              <span aria-hidden="true">·</span>
              <span>{student.email}</span>
              <span aria-hidden="true">·</span>
              <span>Joined {fmtDate(student.created_at)}</span>
            </p>
            <span className={`v2-status v2-status--${student.status}`}>
              <span className="v2-status__dot" aria-hidden="true" />
              {STATUS_LABEL[student.status]}
            </span>
          </div>
        </div>

        <div className="v2-profile-head__actions">
          <Button variant="outline" className="v2-btn--danger-outline" onClick={() => setReported(true)} disabled={reported}>
            <LuShieldAlert aria-hidden="true" /> {reported ? 'Incident reported' : 'Report incident'}
          </Button>
          <Button onClick={onDownloadReport} disabled={downloading}>
            <LuDownload aria-hidden="true" /> {downloading ? 'Preparing…' : 'Download full report'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
