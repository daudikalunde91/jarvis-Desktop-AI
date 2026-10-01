import { create } from 'zustand';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface AppInfo {
  name: string;
  version: string;
  description: string;
}

/**
 * Root Zustand store for foundation-level UI state.
 * Feature-specific stores (brain, memory, voice, ...) will live next to
 * their respective feature modules once those milestones begin.
 */
interface AppState {
  status: ConnectionStatus;
  appInfo: AppInfo | null;
  error: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setAppInfo: (appInfo: AppInfo) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: 'idle',
  appInfo: null,
  error: null,
  setStatus: (status) => set({ status }),
  setAppInfo: (appInfo) => set({ appInfo }),
  setError: (error) => set({ error }),
}));
