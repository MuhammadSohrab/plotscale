import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { CloudProfilePage } from "./pages/CloudProfilePage";
import { DashboardPage } from "./pages/DashboardPage";
import { GuestPage } from "./pages/GuestPage";
import { LoginPage } from "./pages/LoginPage";
import { SavedPlotsPage } from "./pages/SavedPlotsPage";
import { SignupPage } from "./pages/SignupPage";
import { CustomUnitPage } from "./pages/CustomUnitPage";
import { UnitConverterPage } from "./pages/UnitConverterPage";
import { UnitDefaultsPage } from "./pages/UnitDefaultsPage";
import { CompoundRecipePage } from "./pages/CompoundRecipePage";
import { WelcomePage } from "./pages/WelcomePage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AreaCalculatorPage } from "./pages/AreaCalculatorPage";
import ImageTracePage from "./pages/ImageTracePage";
import SketchPadPage from "./pages/SketchPadPage";
import {
  AnonymousRoute,
  AuthenticatedRoute,
  SessionRoute,
} from "./routes/RouteGuards";
import { cloudSyncService } from "./services/CloudSyncService";
import { localDatabaseService } from "./services/LocalDatabaseService";
import { useAppStore } from "./store/useAppStore";
import { unitSyncQueue } from "./services/UnitSyncQueue";
import { unitProfileRepository } from "./services/UnitProfileRepository";

export default function App() {
  const setSession = useAppStore((state) => state.setSession);
  const setSettings = useAppStore((state) => state.setSettings);
  const setProfile = useAppStore((state) => state.setProfile);
  const setEntitlements = useAppStore((state) => state.setEntitlements);
  const setStorageReady = useAppStore((state) => state.setStorageReady);
  const currentUser = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);

  useEffect(() => {
    let active = true;
    localDatabaseService
      .initialize()
      .then(() => {
        if (active) setStorageReady(true);
      })
      .catch(() => active && setStorageReady(false));

    cloudSyncService
      .getSession()
      .then(async (session) => {
        if (!active) return;
        setSession(session);
        if (session?.user) {
          const [settingsResult, profileResult, entitlementResult] = await Promise.allSettled([
            cloudSyncService.getSettings(session.user.id),
            cloudSyncService.getProfile(session.user.id),
            cloudSyncService.getEntitlements(session.user.id),
          ]);
          const cachedEntitlements = useAppStore.getState().entitlements;
          const nextEntitlements = entitlementResult.status === "fulfilled"
            ? entitlementResult.value
            : cachedEntitlements;
          if (active) {
            if (settingsResult.status === "fulfilled") setSettings(settingsResult.value);
            if (profileResult.status === "fulfilled") setProfile(profileResult.value);
            setEntitlements(nextEntitlements);
          }
          if (
            ["active", "trial"].includes(nextEntitlements.subscriptionStatus)
            && (!nextEntitlements.validUntil
              || Date.now() <= new Date(nextEntitlements.offlineGraceUntil ?? nextEntitlements.validUntil).getTime())
          ) {
            unitProfileRepository.pullAndMerge(session.user.id).catch(() => {});
          }
        } else {
          setProfile(null);
          setEntitlements({ subscriptionStatus: "free", capabilities: {} });
        }
      })
      .catch(() => {
        if (active && useAppStore.getState().sessionStatus === "loading") setSession(null);
      });

    const unsubscribe = cloudSyncService.onAuthStateChange((session) => {
      if (!active) return;
      setSession(session);
      if (session?.user) {
        Promise.allSettled([
          cloudSyncService.getSettings(session.user.id),
          cloudSyncService.getProfile(session.user.id),
          cloudSyncService.getEntitlements(session.user.id),
        ])
          .then(([settings, profile, entitlements]) => {
            if (active) {
              if (settings.status === "fulfilled") setSettings(settings.value);
              if (profile.status === "fulfilled") setProfile(profile.value);
              if (entitlements.status === "fulfilled") setEntitlements(entitlements.value);
            }
          })
          .catch(() => {});
      } else {
        setProfile(null);
        setEntitlements({ subscriptionStatus: "free", capabilities: {} });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [setEntitlements, setProfile, setSession, setSettings, setStorageReady]);

  useEffect(() => {
    if (!currentUser || !["active", "trial"].includes(entitlements.subscriptionStatus)) return undefined;
    const retry = () => unitSyncQueue.process(currentUser.id).catch(() => {});
    retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [currentUser, entitlements.subscriptionStatus]);

  return (
    <Routes>
      <Route element={<AnonymousRoute />}>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/guest" element={<GuestPage />} />
      </Route>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<SessionRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/calculator" element={<AreaCalculatorPage />} />
        <Route path="/image-trace" element={<ImageTracePage />} />
        <Route path="/sketch" element={<SketchPadPage />} />
        <Route path="/units" element={<UnitDefaultsPage />} />
        <Route path="/units/custom" element={<CustomUnitPage />} />
        <Route path="/units/compound" element={<CompoundRecipePage />} />
        <Route path="/units/*" element={<Navigate to="/units" replace />} />
        <Route path="/converter" element={<UnitConverterPage />} />
      </Route>
      <Route element={<AuthenticatedRoute />}>
        <Route path="/cloud-profile" element={<CloudProfilePage />} />
        <Route path="/saved-plots" element={<SavedPlotsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
