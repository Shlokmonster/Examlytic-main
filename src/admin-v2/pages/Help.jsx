import { Link } from 'react-router-dom';
import { LuCamera, LuChevronDown, LuCopy, LuGlobe, LuKeyRound, LuMail, LuMaximize, LuMonitorUp, LuShieldCheck, LuWifi } from 'react-icons/lu';
import './help/Help.css';
import PageHeader from '../components/PageHeader';
import NotificationBell from '../components/notifications/NotificationBell';
import { Button, Card } from '../components/ui';
import { useToast } from '../components/toast/toastContext';
import { isMac } from '../components/command/commandContext';
import { currentSupportEmail } from '../data/settings';
import { ADMIN_V2_BASE } from '../layout/navItems';

const STEPS = [
  { icon: LuKeyRound, title: 'Enter the exam code', body: 'Students open the join link and type the code from the Exams page, e.g. PHY-7K2Q.' },
  { icon: LuShieldCheck, title: 'Pass the system check', body: 'Camera, microphone, screen sharing and browser are checked before the exam can start.' },
  { icon: LuMaximize, title: 'Start the exam', body: 'The exam opens in fullscreen. The timer starts and proctoring runs until they submit.' },
];

const REQUIREMENTS = [
  { icon: LuGlobe, text: 'An up-to-date Chrome, Edge, Firefox or Safari on a laptop or desktop' },
  { icon: LuCamera, text: 'A webcam and microphone, allowed when the browser asks' },
  { icon: LuMonitorUp, text: 'Screen sharing allowed for the whole exam' },
  { icon: LuWifi, text: 'A stable internet connection' },
  { icon: LuMaximize, text: 'Stay in fullscreen on the exam tab. Leaving is logged.' },
];

// Answers describe how the app actually behaves (see CLAUDE.md, examService, ExamAttempt).
const FAQ = [
  {
    q: 'A student lost connection. Can they continue?',
    a: 'Yes. The timer runs on the server from the moment they started, so they rejoin with the same exam code and continue the same attempt. Time spent offline still counts. In Live Monitor they show as Reconnecting, and after 45 seconds without a signal as Interrupted.',
  },
  {
    q: 'How do I stop students from starting an exam?',
    a: 'Turn off Access for the exam in the Exams list view, or choose Lock from its ⋯ menu. Students who try to join see a blocked screen until you unlock it.',
  },
  {
    q: 'What happens when the time runs out?',
    a: 'The exam submits automatically with the answers saved so far. Pressing the browser Back button during the exam also submits it.',
  },
  {
    q: 'Why was a student flagged?',
    a: 'Flags come from webcam checks (no face, more than one face, a phone or book, looking away) and browser events (switching tabs, leaving fullscreen, stopping screen share, copy or paste). Webcam checks only run when webcam proctoring is on for that exam.',
  },
  {
    q: "Does a flag change the student's score?",
    a: 'No. Scores are graded on the server from the answers only. Flagged attempts go to the Review Queue, where you mark them Clean, Suspicious or Cheating confirmed.',
  },
  {
    q: "Where can I watch a student's recording?",
    a: "Open the student's profile and click Review on any exam, or open the case in the Review Queue. Recordings upload after the student submits, so a just-finished exam can take a minute to appear.",
  },
];

export default function Help() {
  const toast = useToast();
  const joinLink = `${window.location.origin}/examcode`;
  const supportEmail = currentSupportEmail();
  const mod = isMac() ? '⌘' : 'Ctrl';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      toast({ message: 'Join link copied' });
    } catch {
      toast({ message: 'Could not copy. Select the link and copy it manually.', tone: 'danger' });
    }
  };

  return (
    <div className="v2-help-page">
      <PageHeader title="Help & Support">
        <NotificationBell />
      </PageHeader>

      <Card className="v2-help-join">
        <div className="v2-card-head">
          <div>
            <h2 className="h2">How students join</h2>
            <p className="v2-help__sub">Share the link and the exam code. That is all students need.</p>
          </div>
        </div>

        <ol className="v2-help-steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="v2-help-step">
                <span className="v2-help-step__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="v2-help-step__num">Step {i + 1}</span>
                <strong className="v2-help-step__title">{s.title}</strong>
                <p className="v2-help-step__body">{s.body}</p>
              </li>
            );
          })}
        </ol>

        <div className="v2-help-link">
          <code className="v2-help-link__url">{joinLink}</code>
          <Button size="sm" onClick={copyLink}>
            <LuCopy aria-hidden="true" /> Copy link
          </Button>
        </div>
      </Card>

      <div className="v2-help-grid">
        <Card>
          <h2 className="h3 v2-help__title">What students need</h2>
          <ul className="v2-help-reqs">
            {REQUIREMENTS.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.text}>
                  <Icon aria-hidden="true" />
                  {r.text}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="v2-help-side">
          <Card>
            <h2 className="h3 v2-help__title">Support contact</h2>
            <p className="v2-help__sub">Your support email. Share it with students who need help.</p>
            <a className="v2-help-mail" href={`mailto:${supportEmail}`}>
              <LuMail aria-hidden="true" /> {supportEmail}
            </a>
            <Link to={`${ADMIN_V2_BASE}/settings`} className="v2-linkbtn">
              Change in Settings
            </Link>
          </Card>

          <Card>
            <h2 className="h3 v2-help__title">Keyboard shortcuts</h2>
            <dl className="v2-help-keys">
              <div>
                <dt>Search anything</dt>
                <dd>
                  <kbd className="v2-kbd">{mod}</kbd>
                  <kbd className="v2-kbd">K</kbd>
                </dd>
              </div>
              <div>
                <dt>Review Queue: next / previous</dt>
                <dd>
                  <kbd className="v2-kbd">J</kbd>
                  <kbd className="v2-kbd">K</kbd>
                </dd>
              </div>
              <div>
                <dt>Review Queue: decide</dt>
                <dd>
                  <kbd className="v2-kbd">1</kbd>
                  <kbd className="v2-kbd">2</kbd>
                  <kbd className="v2-kbd">3</kbd>
                </dd>
              </div>
              <div>
                <dt>Recording: play / skip 10s</dt>
                <dd>
                  <kbd className="v2-kbd">Space</kbd>
                  <kbd className="v2-kbd">←</kbd>
                  <kbd className="v2-kbd">→</kbd>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="h2 v2-help__faq-title">Frequently asked questions</h2>
        <div className="v2-help-faq">
          {FAQ.map((item) => (
            <details key={item.q} className="v2-help-faq__item">
              <summary>
                {item.q}
                <LuChevronDown aria-hidden="true" />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
