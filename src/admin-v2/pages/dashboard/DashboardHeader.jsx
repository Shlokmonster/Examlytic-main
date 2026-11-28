import { useState } from 'react';
import { LuGlobe, LuMessageCircleMore, LuMoon, LuSun, LuUserPlus } from 'react-icons/lu';
import { useAuth } from '../../../hooks/useAuth';
import { Button, Card, IconButton } from '../../components/ui';
import DateLine from '../../components/DateLine';
import NotificationBell from '../../components/notifications/NotificationBell';

function greeting(hour) {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function DashboardHeader() {
  const { user, profile } = useAuth();
  const [mode, setMode] = useState('light');
  const now = new Date();
  const fullName = profile?.user_name || user?.user_metadata?.full_name || 'Admin';
  const firstName = fullName.split(' ')[0];

  return (
    <Card className="v2-dash-header">
      <div>
        <h1 className="h1">
          {greeting(now.getHours())}, {firstName}
        </h1>
        <DateLine />
      </div>

      <div className="v2-dash-header__actions">
        <div className="v2-theme-toggle" role="group" aria-label="Theme">
          <IconButton
            label="Light mode"
            variant={mode === 'light' ? 'primary' : 'ghost'}
            aria-pressed={mode === 'light'}
            onClick={() => setMode('light')}
          >
            <LuSun />
          </IconButton>
          <IconButton
            label="Dark mode (coming soon)"
            variant={mode === 'dark' ? 'primary' : 'ghost'}
            aria-pressed={mode === 'dark'}
            onClick={() => setMode('dark')}
          >
            <LuMoon />
          </IconButton>
        </div>
        <NotificationBell />
        <IconButton label="Messages">
          <LuMessageCircleMore />
        </IconButton>
        <IconButton label="Language">
          <LuGlobe />
        </IconButton>
        <Button className="v2-dash-header__invite">
          Invite Students <LuUserPlus aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}
