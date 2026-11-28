import { createContext, useContext } from 'react';

export const NotificationsContext = createContext({
  items: [],
  unread: 0,
  markRead: () => {},
  markAllRead: () => {},
});

export const useNotifications = () => useContext(NotificationsContext);
