import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LuMenu } from 'react-icons/lu';
import '../theme/index.css';
import '../components/components.css';
import './AdminLayout.css';
import Sidebar from './Sidebar';
import Logo from '../components/Logo';
import { IconButton } from '../components/ui';
import ToastProvider from '../components/toast/ToastProvider';
import NotificationsProvider from '../components/notifications/NotificationsProvider';
import CommandPaletteProvider from '../components/command/CommandPalette';

export default function AdminLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const close = () => setNavOpen(false);

  return (
    <div className="admin-v2 v2-shell">
      <ToastProvider>
        <NotificationsProvider>
          <CommandPaletteProvider>
            <Sidebar open={navOpen} onClose={close} />
            {navOpen && <div className="v2-scrim" onClick={close} aria-hidden="true" />}

            <div className="v2-main">
              <div className="v2-mobilebar">
                <Logo size={28} />
                <IconButton label="Open menu" onClick={() => setNavOpen(true)}>
                  <LuMenu />
                </IconButton>
              </div>
              <main className="v2-panel">
                <Outlet />
              </main>
            </div>
          </CommandPaletteProvider>
        </NotificationsProvider>
      </ToastProvider>
    </div>
  );
}
