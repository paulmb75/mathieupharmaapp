import { AlertCircle } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  id,
  label,
  required,
  hint,
  error,
  plainLabel,
  children,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  plainLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mp-field">
      <label htmlFor={id} className={`mp-label${plainLabel ? " mp-label--plain" : ""}`}>
        {label}
        {required && (
          <span className="mp-required" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="mp-field-error" id={`${id}-error`} role="alert">
          <AlertCircle aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p className="mp-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, invalid?: boolean) {
  return invalid ? `${id}-error` : `${id}-hint`;
}

export function TextInput({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; id: string }) {
  return (
    <input
      className={["mp-input", invalid && "mp-input--invalid", className].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(props.id, invalid)}
      {...props}
    />
  );
}

export function Select({ invalid, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; id: string }) {
  return (
    <select
      className={["mp-select", invalid && "mp-input--invalid", className].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(props.id, invalid)}
      {...props}
    >
      {children}
    </select>
  );
}

export function TextArea({ invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; id: string }) {
  return (
    <textarea
      className={["mp-textarea", invalid && "mp-input--invalid", className].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(props.id, invalid)}
      {...props}
    />
  );
}
