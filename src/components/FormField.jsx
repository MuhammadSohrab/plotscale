import { Eye, EyeOff } from "lucide-react";

export function FormField({
  label,
  id,
  error,
  action,
  className = "",
  ...inputProps
}) {
  return (
    <label className={`field ${className}`} htmlFor={id}>
      <span className="field__label">
        {label}
        {action}
      </span>
      <input
        id={id}
        className={`field__input ${error ? "field__input--error" : ""}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
      />
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </label>
  );
}

export function PasswordToggle({ visible, onClick }) {
  return (
    <button
      className="password-toggle"
      type="button"
      onClick={onClick}
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      <span>{visible ? "Hide" : "Show"}</span>
    </button>
  );
}
