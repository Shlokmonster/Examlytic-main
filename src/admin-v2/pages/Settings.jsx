import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuBell, LuBuilding2, LuClipboardList, LuImagePlus, LuTrash2, LuUserPlus, LuUsers } from 'react-icons/lu';
import './settings/Settings.css';
import { Button, Card, Skeleton } from '../components/ui';
import Toggle from '../components/Toggle';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import NotificationBell from '../components/notifications/NotificationBell';
import { useToast } from '../components/toast/toastContext';
import { useData } from '../data/useData';
import { getSettings, saveSettings } from '../data/settings';

const SECTIONS = [
  { value: 'general', label: 'General', icon: LuBuilding2, description: 'Your institution and how students reach you.' },
  { value: 'exams', label: 'Exam defaults', icon: LuClipboardList, description: 'Starting values for every new exam.' },
  { value: 'alerts', label: 'Alerts & notifications', icon: LuBell, description: 'What reaches your bell and how often.' },
  { value: 'team', label: 'Team', icon: LuUsers, description: 'Who can manage exams and proctor.' },
];

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dhaka', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC'];
const ROLES = [
  { value: 'admin', label: 'Admin', hint: 'Everything except billing and ownership' },
  { value: 'proctor', label: 'Proctor', hint: 'Live Monitor and reviews only' },
];

const NOTIFY_OPTIONS = [
  { key: 'ai_flags', label: 'AI cheating flags', description: 'No face, multiple faces, looking away, phones or books.' },
  { key: 'browser', label: 'Browser violations', description: 'Tab switches, leaving fullscreen, copy / paste.' },
  { key: 'disconnects', label: 'Disconnects', description: 'A student loses connection during an exam.' },
  { key: 'starting', label: 'Exams starting soon', description: 'A reminder before a scheduled exam opens.' },
  { key: 'submissions', label: 'Submissions', description: 'Every time a student submits.' },
];

function Row({ label, hint, children }) {
  return (
    <div className="v2-setting-row">
      <div className="v2-setting-row__text">
        <span className="v2-setting-row__label">{label}</span>
        {hint && <span className="v2-setting-row__hint">{hint}</span>}
      </div>
      <div className="v2-setting-row__control">{children}</div>
    </div>
  );
}

function SettingsForm({ initial }) {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some((s) => s.value === params.get('section')) ? params.get('section') : 'general';
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [invite, setInvite] = useState(null); // { email, role }
  const fileRef = useRef(null);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const set = (group, patch) => setDraft((d) => ({ ...d, [group]: { ...d[group], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveSettings(draft);
      setSaved(result);
      setDraft(result);
      toast({ message: 'Settings saved' });
    } finally {
      setSaving(false);
    }
  };

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast({ message: 'Logo must be under 1 MB', tone: 'danger' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('general', { logo: reader.result });
    reader.readAsDataURL(file);
  };

  const sendInvite = () => {
    const email = invite.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    setDraft((d) => ({
      ...d,
      team: [...d.team, { id: `m${Date.now()}`, name: email.split('@')[0], email, role: invite.role, status: 'invited' }],
    }));
    setInvite(null);
    toast({ message: `Invite ready for ${email}. Save to send it.`, tone: 'neutral' });
  };

  const current = SECTIONS.find((s) => s.value === section);
  const { general, examDefaults, alerts, team } = draft;

  return (
    <div className="v2-settings-page">
      <Card className="v2-page-header">
        <div>
          <h1 className="h1">Settings</h1>
          <p className="v2-dateline">Manage your workspace, exam defaults, alerts and team.</p>
        </div>
        <div className="v2-page-header__actions">
          <NotificationBell />
        </div>
      </Card>

      <div className="v2-settings-page__grid">
        <Card className="v2-settings-nav">
          <nav aria-label="Settings sections">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  type="button"
                  className={`v2-settings-nav__item ${section === s.value ? 'is-active' : ''}`}
                  aria-current={section === s.value ? 'page' : undefined}
                  onClick={() => setParams({ section: s.value }, { replace: true })}
                >
                  <Icon aria-hidden="true" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </Card>

        <Card className="v2-settings-body" key={section}>
          <header className="v2-settings-body__head">
            <h2 className="h2">{current.label}</h2>
            <p>{current.description}</p>
          </header>

          {section === 'general' && (
            <>
              <Row label="Logo" hint="Shown on the student login and exam pages. PNG or SVG, under 1 MB.">
                <div className="v2-logo-field">
                  <span className="v2-logo-field__preview">
                    {general.logo ? <img src={general.logo} alt="Institution logo" /> : <LuImagePlus aria-hidden="true" />}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    {general.logo ? 'Replace' : 'Upload'}
                  </Button>
                  {general.logo && (
                    <Button variant="outline" size="sm" onClick={() => set('general', { logo: null })}>
                      Remove
                    </Button>
                  )}
                  <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" hidden onChange={onLogo} />
                </div>
              </Row>
              <Row label="Institution name" hint="Appears on reports and answer sheets.">
                <input className="v2-input" value={general.institution} onChange={(e) => set('general', { institution: e.target.value })} />
              </Row>
              <Row label="Timezone" hint="Exam schedules and reports use this timezone.">
                <select className="v2-input" value={general.timezone} onChange={(e) => set('general', { timezone: e.target.value })}>
                  {TIMEZONES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Support email" hint="Default contact shown to students in new exams.">
                <input
                  className="v2-input"
                  type="email"
                  value={general.support_email}
                  onChange={(e) => set('general', { support_email: e.target.value })}
                />
              </Row>
            </>
          )}

          {section === 'exams' && (
            <>
              <Row label="Default duration" hint="Pre-filled when you create an exam.">
                <span className="v2-input-suffix">
                  <input
                    className="v2-input"
                    type="number"
                    min={5}
                    max={600}
                    value={examDefaults.duration_minutes}
                    onChange={(e) => set('examDefaults', { duration_minutes: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span>minutes</span>
                </span>
              </Row>
              <Row label="Default availability" hint="Whether new exams open anytime or in a set window.">
                <div className="v2-tabs" role="radiogroup" aria-label="Default availability">
                  {[
                    { value: 'anytime', label: 'Open anytime' },
                    { value: 'window', label: 'Time window' },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={examDefaults.availability === m.value}
                      className={`v2-tab ${examDefaults.availability === m.value ? 'is-active' : ''}`}
                      onClick={() => set('examDefaults', { availability: m.value })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Row>
              <div className="v2-setting-toggles">
                <Toggle
                  id="def-webcam"
                  label="AI webcam proctoring on by default"
                  description="You can still turn it off for a single exam."
                  checked={examDefaults.webcam_proctoring}
                  onChange={(v) => set('examDefaults', { webcam_proctoring: v })}
                />
                <Toggle
                  id="def-tabs"
                  label="Strict tab mode on by default"
                  description="Records tab switches and leaving fullscreen as violations."
                  checked={examDefaults.strict_tabs}
                  onChange={(v) => set('examDefaults', { strict_tabs: v })}
                />
              </div>
            </>
          )}

          {section === 'alerts' && (
            <>
              <div className="v2-setting-toggles">
                <span className="v2-setting-row__label">Send to my notification bell</span>
                {NOTIFY_OPTIONS.map((o) => (
                  <Toggle
                    key={o.key}
                    id={`notify-${o.key}`}
                    label={o.label}
                    description={o.description}
                    checked={alerts.notify[o.key]}
                    onChange={(v) => set('alerts', { notify: { ...alerts.notify, [o.key]: v } })}
                  />
                ))}
              </div>
              <Row label="Alert cooldown" hint="Group repeated alerts for the same student and type within this time.">
                <div className="v2-range">
                  <input
                    type="range"
                    min={10}
                    max={300}
                    step={10}
                    value={alerts.cooldown_seconds}
                    onChange={(e) => set('alerts', { cooldown_seconds: Number(e.target.value) })}
                    aria-label="Alert cooldown in seconds"
                  />
                  <span className="v2-range__value">{alerts.cooldown_seconds}s</span>
                </div>
              </Row>
              <Row label="Email digest" hint="A summary of flags and results in your inbox.">
                <div className="v2-tabs" role="radiogroup" aria-label="Email digest">
                  {[
                    { value: 'off', label: 'Off' },
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={alerts.digest === m.value}
                      className={`v2-tab ${alerts.digest === m.value ? 'is-active' : ''}`}
                      onClick={() => set('alerts', { digest: m.value })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Row>
              <div className="v2-setting-toggles">
                <Toggle
                  id="alert-sound"
                  label="Play a sound for new cheating flags"
                  description="Only while Live Monitor is open."
                  checked={alerts.sound}
                  onChange={(v) => set('alerts', { sound: v })}
                />
              </div>
            </>
          )}

          {section === 'team' && (
            <>
              <div className="v2-team__head">
                <span className="v2-setting-row__hint">
                  {team.length} {team.length === 1 ? 'member' : 'members'}
                </span>
                <Button size="sm" onClick={() => setInvite({ email: '', role: 'proctor' })}>
                  <LuUserPlus aria-hidden="true" /> Invite member
                </Button>
              </div>
              <ul className="v2-team">
                {team.map((m) => (
                  <li key={m.id} className="v2-team__row">
                    <Avatar name={m.name} size={36} />
                    <div className="v2-person__text">
                      <span className="v2-person__name">
                        {m.name} {m.status === 'invited' && <span className="v2-pill v2-pill--warning">Invited</span>}
                      </span>
                      <span className="v2-person__email">{m.email}</span>
                    </div>
                    {m.role === 'owner' ? (
                      <span className="v2-pill v2-pill--neutral v2-team__owner">Owner</span>
                    ) : (
                      <>
                        <select
                          className="v2-input v2-team__role"
                          value={m.role}
                          aria-label={`Role for ${m.name}`}
                          onChange={(e) => setDraft((d) => ({ ...d, team: d.team.map((x) => (x.id === m.id ? { ...x, role: e.target.value } : x)) }))}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="v2-icon-btn v2-icon-btn--ghost v2-icon-btn--sm v2-team__remove"
                          aria-label={`Remove ${m.name}`}
                          onClick={() => setDraft((d) => ({ ...d, team: d.team.filter((x) => x.id !== m.id) }))}
                        >
                          <LuTrash2 />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="v2-settings__note">Admins can create and edit exams. Proctors can only watch Live Monitor and review attempts.</p>
            </>
          )}
        </Card>
      </div>

      <div className={`v2-savebar ${dirty ? 'is-visible' : ''}`} role="region" aria-label="Unsaved changes">
        <span>You have unsaved changes</span>
        <Button variant="outline" size="sm" onClick={() => setDraft(saved)} disabled={saving} tabIndex={dirty ? 0 : -1}>
          Discard
        </Button>
        <Button size="sm" onClick={save} disabled={saving} tabIndex={dirty ? 0 : -1}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <Modal
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        width={460}
        title="Invite a team member"
        description="They'll get an email to join this workspace."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setInvite(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={sendInvite} disabled={!invite || !/^\S+@\S+\.\S+$/.test(invite.email.trim())}>
              <LuUserPlus aria-hidden="true" /> Add invite
            </Button>
          </>
        }
      >
        {invite && (
          <>
            <label className="v2-field">
              <span className="v2-field__label">Email</span>
              <input
                className="v2-input"
                type="email"
                placeholder="name@school.edu"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              />
            </label>
            <div className="v2-field">
              <span className="v2-field__label">Role</span>
              <div className="v2-role-options">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`v2-role-option ${invite.role === r.value ? 'is-active' : ''}`}
                    aria-pressed={invite.role === r.value}
                    onClick={() => setInvite({ ...invite, role: r.value })}
                  >
                    <span className="v2-role-option__label">{r.label}</span>
                    <span className="v2-role-option__hint">{r.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default function Settings() {
  const { data, loading } = useData(getSettings);
  if (loading || !data) {
    return (
      <div className="v2-settings-page">
        <Skeleton height={96} style={{ borderRadius: 16 }} />
        <Skeleton height={420} style={{ borderRadius: 16 }} />
      </div>
    );
  }
  return <SettingsForm initial={data} />;
}
