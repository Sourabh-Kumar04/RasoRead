import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserSettings {
  theme: "dark" | "sepia" | "light";
  fontSize: number;
  dyslexiaMode: boolean;
  defaultVoice: string;
  defaultSpeed: number;
  autoResume: boolean;
  voiceCommandsEnabled: boolean;
}

interface SessionState {
  // Auth
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;

  // Preferences
  settings: UserSettings;

  // Actions
  setUser: (id: string, name: string, email: string) => void;
  clearUser: () => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: "dark",
  fontSize: 20,
  dyslexiaMode: false,
  defaultVoice: "en-US-Journey-F",
  defaultSpeed: 1.0,
  autoResume: true,
  voiceCommandsEnabled: true,
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      userName: null,
      userEmail: null,
      isAuthenticated: false,
      settings: DEFAULT_SETTINGS,

      setUser: (id, name, email) =>
        set({ userId: id, userName: name, userEmail: email, isAuthenticated: true }),

      clearUser: () =>
        set({ userId: null, userName: null, userEmail: null, isAuthenticated: false }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "rasoread-session",
      partialize: (s) => ({
        userId: s.userId,
        userName: s.userName,
        userEmail: s.userEmail,
        isAuthenticated: s.isAuthenticated,
        settings: s.settings,
      }),
    }
  )
);
