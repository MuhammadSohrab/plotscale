import { LockKeyhole, Smartphone } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { FormField, PasswordToggle } from "../components/FormField";
import { OAuthButtons } from "../components/OAuthButtons";
import { ScreenShell } from "../components/ScreenShell";
import { cloudSyncService } from "../services/CloudSyncService";
import { isCloudConfigured } from "../services/supabaseClient";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await cloudSyncService.signIn({ email, password });
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }
    try {
      await cloudSyncService.sendPasswordReset(email);
      setNotice("Password reset instructions have been sent.");
    } catch (caught) {
      setError(caught.message);
    }
  };

  return (
    <ScreenShell className="auth-screen">
      <section className="auth-wrap">
        <div className="auth-brand"><Brand stacked /></div>
        <form className="auth-card" onSubmit={submit}>
          <h1>Welcome back</h1>
          <p>Log in to sync your unit profiles.</p>
          {location.state?.cloudRequired && (
            <div className="inline-notice">An account is required for cloud settings.</div>
          )}
          {!isCloudConfigured && (
            <div className="inline-notice inline-notice--warning">
              Cloud sign-in needs Supabase environment keys. Guest Mode is ready now.
            </div>
          )}
          {error && <div className="form-message form-message--error">{error}</div>}
          {notice && <div className="form-message form-message--success">{notice}</div>}
          <div className="field-stack">
            <FormField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="surveyor@plotscale.app"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <FormField
              id="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              action={
                <PasswordToggle
                  visible={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                />
              }
            />
          </div>
          <button className="forgot-link" type="button" onClick={resetPassword}>
            Forgot password?
          </button>
          <button className="primary-button" disabled={busy || !isCloudConfigured} type="submit">
            {busy ? "Signing in…" : "Log in"}
          </button>
          <OAuthButtons
            disabled={!isCloudConfigured}
            onError={(message) => setError(message)}
          />
          <button
            className="secondary-button"
            type="button"
            disabled
            title="Mobile OTP will be available when a phone provider is configured."
          >
            <Smartphone size={18} /> Continue with Mobile OTP
          </button>
        </form>
        <aside className="sync-banner">
          <LockKeyhole size={19} />
          <span>Login securely syncs your custom units to the cloud.</span>
        </aside>
        <p className="auth-switch">New to PlotScale? <Link to="/signup">Register</Link></p>
      </section>
    </ScreenShell>
  );
}
