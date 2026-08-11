import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

export function SessionRoute() {
  const { sessionStatus, user, isGuest } = useAppStore();
  const location = useLocation();
  if (sessionStatus === "loading") return <div className="route-loader">Loading PlotScale…</div>;
  if (!user && !isGuest) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function AuthenticatedRoute() {
  const { sessionStatus, user } = useAppStore();
  const location = useLocation();
  if (sessionStatus === "loading") return <div className="route-loader">Checking session…</div>;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, cloudRequired: true }} />;
  }
  return <Outlet />;
}

export function AnonymousRoute() {
  const { sessionStatus, user } = useAppStore();
  if (sessionStatus === "loading") return <div className="route-loader">Loading PlotScale…</div>;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
