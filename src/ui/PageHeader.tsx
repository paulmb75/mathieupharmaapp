import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mp-page-head">
      <div>
        <h1 className="mp-page-title">{title}</h1>
        {subtitle && <p className="mp-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="mp-row mp-row--wrap">{actions}</div>}
    </header>
  );
}

export function SectionHead({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mp-section-head">
      <h2 className="mp-section-title">{title}</h2>
      {action}
    </div>
  );
}

export function SectionBanner({ icon, title, subtitle }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mp-banner-section">
      <span className="mp-icon-circle">{icon}</span>
      <div>
        <h2 className="mp-banner-section__title">{title}</h2>
        {subtitle && <p className="mp-banner-section__sub">{subtitle}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mp-empty">
      {icon}
      <p className="mp-empty__title">{title}</p>
      {children && <div className="mp-small">{children}</div>}
    </div>
  );
}
