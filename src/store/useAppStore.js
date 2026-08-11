import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_APP_SETTINGS } from "../models/cloudModels";

const memoryStorage = {
  values: new Map(),
  getItem(key) {
    return this.values.get(key) ?? null;
  },
  setItem(key, value) {
    this.values.set(key, value);
  },
  removeItem(key) {
    this.values.delete(key);
  },
};

export const useAppStore = create(
  persist(
    (set) => ({
      sessionStatus: "loading",
      user: null,
      profile: null,
      entitlements: { subscriptionStatus: "free", capabilities: {} },
      isGuest: false,
      settings: { ...DEFAULT_APP_SETTINGS },
      storageReady: false,
      setSession: (session) =>
        set((state) => ({
          user: session?.user ?? null,
          isGuest: session?.user ? false : state.isGuest,
          sessionStatus: session?.user
            ? "authenticated"
            : state.isGuest
              ? "guest"
              : "anonymous",
        })),
      setProfile: (profile) => set({ profile: profile ?? null }),
      setEntitlements: (entitlements) =>
        set({ entitlements: entitlements ?? { subscriptionStatus: "free", capabilities: {} } }),
      enterGuestMode: () =>
        set({ user: null, isGuest: true, sessionStatus: "guest" }),
      exitGuestMode: () => set({ isGuest: false, sessionStatus: "anonymous" }),
      setSettings: (settings) =>
        set((state) => ({ settings: { ...state.settings, ...settings } })),
      setStorageReady: (storageReady) => set({ storageReady }),
      resetSession: () =>
        set({
          user: null,
          profile: null,
          entitlements: { subscriptionStatus: "free", capabilities: {} },
          isGuest: false,
          sessionStatus: "anonymous",
        }),
    }),
    {
      name: "plotscale.app",
      storage: createJSONStorage(() =>
        typeof localStorage === "undefined" ? memoryStorage : localStorage,
      ),
      partialize: (state) => ({
        isGuest: state.isGuest,
        settings: state.settings,
        entitlements: state.entitlements,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isGuest) state.enterGuestMode();
      },
    },
  ),
);
