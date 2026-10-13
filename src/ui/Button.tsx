import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "neutral" | "danger" | "danger-outline" | "success";

type Common = {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  icon?: ReactNode;
  className?: string;
};

function classes({ variant = "primary", size = "md", block, className }: Common) {
  return ["mp-btn", `mp-btn--${variant}`, size !== "md" && `mp-btn--${size}`, block && "mp-btn--block", className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  block,
  icon,
  loading,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="mp-spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...rest
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={classes({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
