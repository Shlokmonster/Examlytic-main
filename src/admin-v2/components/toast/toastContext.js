import { createContext, useContext } from 'react';

export const ToastContext = createContext({ toast: () => {} });

/** toast({ message, tone?: 'success' | 'danger' | 'neutral', action?: { label, onClick } }) */
export const useToast = () => useContext(ToastContext).toast;
