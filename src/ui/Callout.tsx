import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronRight, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "warning" | "info" | "danger" | "success";

const ICONS = { warning: AlertCircle, info: Info, danger: XCircle, success: CheckCircle2 };

export function Callout({
  tone = "info",
  title,
  children,
  href,
  action,
  icon,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  href?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const Icon = ICONS[tone];
  const content = (
    <>
      {icon ?? <Icon className="mp-callout__icon" aria-hidden fill={tone === "warning" ? "currentColor" : "none"} stroke={tone === "warning" ? "#fff" : "currentColor"} />}
      <div className="mp-callout__body">
        {title && <div className="mp-callout__title">{title}</div>}
        {children && <div className="mp-callout__text">{children}</div>}
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
      {href && <ChevronRight className="mp-callout__chevron" aria-hidden />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`mp-callout mp-callout--${tone}`}>
        {content}
      </Link>
    );
  }
  return (
    <div className={`mp-callout mp-callout--${tone}`} role={tone === "danger" ? "alert" : undefined}>
      {content}
    </div>
  );
}
