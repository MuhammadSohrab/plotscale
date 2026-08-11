import { Check, KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { FormField, PasswordToggle } from "../components/FormField";
import { ScreenShell } from "../components/ScreenShell";
import { cloudSyncService } from "../services/CloudSyncService";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = useMemo(() =>
    password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password),
  [password]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!valid) return setError("Use at least 8 characters with a letter and number.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await cloudSyncService.updatePassword(password);
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <ScreenShell className="auth-screen">
      <section className="auth-wrap">
        <div className="auth-brand"><Brand stacked /></div>
        <form className="auth-card" onSubmit={submit}>
          <span className="access-dialog__icon"><KeyRound size={24} /></span>
          <h1>Set a new password</h1>
          <p>Your reset link securely opened this page.</p>
          {error && <div className="form-message form-message--error">{error}</div>}
          <FormField
            id="new-password"
            label="New password"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            action={<PasswordToggle visible={visible} onClick={() => setVisible((current) => !current)} />}
          />
          <div className="password-rules">
            <span className={valid ? "is-valid" : ""}><Check size={13} /> 8+ characters, a letter and number</span>
          </div>
          <FormField
            id="confirm-new-password"
            label="Confirm new password"
            type={visible ? "text" : "password"}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
          />
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
          <Link className="guest-inline-link" to="/login">Back to login</Link>
        </form>
      </section>
    </ScreenShell>
  );
}
