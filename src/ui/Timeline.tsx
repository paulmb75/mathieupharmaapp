import {
  BadgeCheck,
  Building2,
  FilePlus2,
  FileMinus2,
  FileText,
  MessageSquare,
  MessageSquareWarning,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import { formatDateTime } from "@/domain/dates";
import { ROLE_SHORT_LABELS, type Role } from "@/domain/roles";
import { EVENT_LABELS, type DossierEventType } from "@/domain/status";

export type TimelineEvent = {
  id: string;
  type: DossierEventType;
  message: string | null;
  createdAt: Date;
  actorName: string;
  actorRole: Role;
};

const VISUALS: Record<DossierEventType, { icon: typeof Send; tone: string }> = {
  created: { icon: FileText, tone: "neutral" },
  submitted: { icon: Send, tone: "info" },
  resubmitted: { icon: RotateCcw, tone: "info" },
  info_requested: { icon: MessageSquareWarning, tone: "warning" },
  validated: { icon: BadgeCheck, tone: "accent" },
  rejected: { icon: XCircle, tone: "danger" },
  quadra_created: { icon: Building2, tone: "success" },
  document_added: { icon: FilePlus2, tone: "neutral" },
  document_removed: { icon: FileMinus2, tone: "neutral" },
  comment: { icon: MessageSquare, tone: "neutral" },
};

export function Timeline({ events, showMessages = true }: { events: TimelineEvent[]; showMessages?: boolean }) {
  return (
    <ol className="mp-timeline">
      {events.map((e) => {
        const v = VISUALS[e.type];
        const Icon = v.icon;
        return (
          <li key={e.id} className="mp-timeline__item">
            <span className={`mp-timeline__dot mp-timeline__dot--${v.tone}`} aria-hidden>
              <Icon />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="mp-timeline__title">{EVENT_LABELS[e.type]}</p>
              <p className="mp-timeline__meta">
                {e.actorName} ({ROLE_SHORT_LABELS[e.actorRole]}) · {formatDateTime(e.createdAt)}
              </p>
              {showMessages && e.message && <p className="mp-timeline__message">{e.message}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
