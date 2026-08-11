import { Check, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { FormField, PasswordToggle } from "../components/FormField";
import { OAuthButtons } from "../components/OAuthButtons";
import { ScreenShell } from "../components/ScreenShell";
import { cloudSyncService } from "../services/CloudSyncService";
import { isCloudConfigured } from "../services/supabaseClient";

export function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const checks = useMemo(
    () => ({
      length: form.password.length >= 8,
      letter: /[A-Za-z]/.test(form.password),
      number: /\d/.test(form.password),
    }),
    [form.password],
  );

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!Object.values(checks).every(Boolean)) {
      setError("Use at least 8 characters with a letter and number.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const data = await cloudSyncService.signUp(form);
      if (data.session) navigate("/dashboard", { replace: true });
      else setNotice("Check your email to confirm your account.");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell className="auth-screen">
      <section className="auth-wrap signup-wrap">
        <div className="auth-brand"><Brand compact stacked /></div>
        <form className="auth-card" onSubmit={submit}>
          <h1>Create your account</h1>
          <p>Keep settings and local unit profiles in sync.</p>
          {!isCloudConfigured && (
            <div className="inline-notice inline-notice--warning">
              Registration needs Supabase environment keys. You can continue offline.
            </div>
          )}
          {error && <div className="form-message form-message--error">{error}</div>}
          {notice && <div className="form-message form-message--success">{notice}</div>}
          <div className="field-stack field-stack--compact">
            <FormField
              id="name"
              label="Full name"
              autoComplete="name"
              placeholder="Your name"
              value={form.name}
              onChange={set("name")}
              required
            />
            <FormField
              id="signup-email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set("email")}
              required
            />
            <FormField
              id="signup-password"
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a secure password"
              value={form.password}
              onChange={set("password")}
              required
              action={
                <PasswordToggle
                  visible={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                />
              }
            />
            <div className="password-rules" aria-label="Password requirements">
              {[
                ["length", "8+ characters"],
                ["letter", "A letter"],
                ["number", "A number"],
              ].map(([key, label]) => (
                <span className={checks[key] ? "is-valid" : ""} key={key}>
                  <Check size={13} /> {label}
                </span>
              ))}
            </div>
            <FormField
              id="confirm-password"
              label="Confirm password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={set("confirm")}
              required
            />
          </div>
          <button className="primary-button" disabled={busy || !isCloudConfigured} type="submit">
            {busy ? "Creating account…" : "Create account"}
          </button>
          <OAuthButtons
            disabled={!isCloudConfigured}
            onError={(message) => setError(message)}
          />
          <Link className="guest-inline-link" to="/guest">Continue as Guest</Link>
        </form>
        <aside className="sync-banner">
          <LockKeyhole size={19} />
          <span>Your profile is lightweight; plots and media stay on this device.</span>
        </aside>
        <p className="auth-switch">Already registered? <Link to="/login">Log in</Link></p>
      </section>
    </ScreenShell>
  );
}
