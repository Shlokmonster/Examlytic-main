import { createContext } from 'react';

export const AuthContext = createContext({
  user: null,
  session: null,
  role: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

export default AuthContext;

