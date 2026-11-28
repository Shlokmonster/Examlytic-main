import { useCallback, useEffect, useMemo, useState } from 'react';
import { NotificationsContext } from './notificationsContext';
import { seedNotifications, subscribeMockNotifications } from '../../data/notifications';

/** Holds the admin's notifications for every page (one inbox behind every bell). */
export default function NotificationsProvider({ children }) {
  const [items, setItems] = useState(seedNotifications);

  useEffect(() => subscribeMockNotifications((n) => setItems((list) => [n, ...list].slice(0, 50))), []);

  const markRead = useCallback((id) => setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllRead = useCallback(() => setItems((list) => list.map((n) => ({ ...n, read: true }))), []);

  const value = useMemo(
    () => ({ items, unread: items.filter((n) => !n.read).length, markRead, markAllRead }),
    [items, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
