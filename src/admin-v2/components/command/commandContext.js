import { createContext, useContext } from 'react';

export const CommandContext = createContext({ openPalette: () => {} });

export const useCommandPalette = () => useContext(CommandContext);

export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
