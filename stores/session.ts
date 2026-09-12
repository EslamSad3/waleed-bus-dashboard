import { create } from "zustand";

export type SessionState = {
  id: string;
  email: string | null;
  /** From GET /auth/me (CurrentUserDto.appRole). `app_role` lives inside the JWT only. */
  appRole: string;
};

type SessionStore = {
  session: SessionState | null;
  setSession: (s: SessionState | null) => void;
};

export const useSessionStore = create<SessionStore>()((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));
