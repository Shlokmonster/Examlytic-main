import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuChevronLeft, LuCircleAlert, LuCloudUpload, LuSend } from 'react-icons/lu';
import { Button, Card } from '../../components/ui';
import { ADMIN_V2_BASE } from '../../layout/navItems';

function savedLabel(savedAt, now) {
  if (!savedAt) return 'Not saved yet';
  const s = Math.round((now - savedAt) / 1000);
  if (s < 10) return 'Saved just now';
  if (s < 60) return `Saved ${s}s ago`;
  return `Saved ${Math.round(s / 60)} min ago`;
}

export default function BuilderTopBar({ exam, dirty, saving, savedAt, now, errors, onSaveDraft, onPublish, onBack }) {
  const [showErrors, setShowErrors] = useState(false);
  const published = exam.status === 'published';

  return (
    <Card className="v2-builder-top">
      <div className="v2-builder-top__left">
        <Link
          to={`${ADMIN_V2_BASE}/exams`}
          className="v2-backlink"
          onClick={(e) => {
            if (!onBack()) e.preventDefault();
          }}
        >
          <LuChevronLeft aria-hidden="true" /> Exams
        </Link>
        <div className="v2-builder-top__title-row">
          <h1 className="v2-builder-top__title">{exam.title.trim() || 'Untitled exam'}</h1>
          <span className={`v2-pill ${published ? 'v2-pill--success' : 'v2-pill--neutral'}`}>{published ? 'Published' : 'Draft'}</span>
        </div>
      </div>

      <div className="v2-builder-top__right">
        <span className={`v2-builder-top__state ${dirty ? 'is-dirty' : ''}`} aria-live="polite">
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : savedLabel(savedAt, now)}
        </span>

        {errors.length > 0 && (
          <div className="v2-builder-errors">
            <button type="button" className="v2-builder-errors__btn" onClick={() => setShowErrors((s) => !s)} aria-expanded={showErrors}>
              <LuCircleAlert aria-hidden="true" /> {errors.length} {errors.length === 1 ? 'issue' : 'issues'} to fix
            </button>
            {showErrors && (
              <ul className="v2-builder-errors__list" role="list">
                {errors.map((e) => (
                  <li key={e.key}>
                    <button
                      type="button"
                      onClick={() => {
                        e.onGo?.();
                        setShowErrors(false);
                      }}
                    >
                      {e.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Button variant="outline" onClick={onSaveDraft} disabled={saving || (!dirty && savedAt)}>
          <LuCloudUpload aria-hidden="true" /> {published ? 'Save changes' : 'Save draft'}
        </Button>
        <Button onClick={onPublish} disabled={saving}>
          <LuSend aria-hidden="true" /> {published ? 'Update exam' : 'Publish'}
        </Button>
      </div>
    </Card>
  );
}
