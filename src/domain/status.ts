import type { Role } from "./roles";

/**
 * Cycle de vie d'une demande d'ouverture de compte.
 *
 * La validation ADV n'équivaut PAS à une création dans Quadra : « Créé dans Quadra »
 * exige une confirmation distincte de l'ADV et une référence de compte.
 */
export const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "NEEDS_INFO",
  "VALIDATED",
  "CREATED_IN_QUADRA",
  "REJECTED",
] as const;
export type DossierStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<DossierStatus, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis à l’ADV",
  NEEDS_INFO: "À compléter",
  VALIDATED: "Validé par l’ADV",
  CREATED_IN_QUADRA: "Créé dans Quadra",
  REJECTED: "Refusé",
};

export type StatusTone = "neutral" | "info" | "warning" | "accent" | "success" | "danger";

export const STATUS_TONES: Record<DossierStatus, StatusTone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  NEEDS_INFO: "warning",
  VALIDATED: "accent",
  CREATED_IN_QUADRA: "success",
  REJECTED: "danger",
};

/** Statuts dans lesquels le commercial propriétaire peut modifier le dossier et ses pièces. */
export const EDITABLE_STATUSES: readonly DossierStatus[] = ["DRAFT", "NEEDS_INFO"];

export function isEditableStatus(status: DossierStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export const TRANSITION_ACTIONS = [
  "submit",
  "request_info",
  "validate",
  "reject",
  "confirm_quadra",
] as const;
export type TransitionAction = (typeof TRANSITION_ACTIONS)[number];

export interface TransitionRule {
  from: readonly DossierStatus[];
  to: DossierStatus;
  role: Role;
  /** Seul le commercial propriétaire du dossier peut déclencher la transition. */
  ownerOnly: boolean;
  /** Un texte (commentaire, motif) est obligatoire. */
  requiresMessage: boolean;
  label: string;
}

/**
 * Table des transitions autorisées. C'est la seule source de vérité :
 * le serveur la consulte avant toute modification de statut.
 */
export const TRANSITIONS: Record<TransitionAction, TransitionRule> = {
  submit: {
    from: ["DRAFT", "NEEDS_INFO"],
    to: "SUBMITTED",
    role: "commercial",
    ownerOnly: true,
    requiresMessage: false,
    label: "Transmettre à l’ADV",
  },
  request_info: {
    from: ["SUBMITTED", "VALIDATED"],
    to: "NEEDS_INFO",
    role: "adv",
    ownerOnly: false,
    requiresMessage: true,
    label: "Demander un complément",
  },
  validate: {
    from: ["SUBMITTED"],
    to: "VALIDATED",
    role: "adv",
    ownerOnly: false,
    requiresMessage: false,
    label: "Valider le dossier",
  },
  reject: {
    from: ["SUBMITTED", "VALIDATED"],
    to: "REJECTED",
    role: "adv",
    ownerOnly: false,
    requiresMessage: true,
    label: "Refuser le dossier",
  },
  confirm_quadra: {
    from: ["VALIDATED"],
    to: "CREATED_IN_QUADRA",
    role: "adv",
    ownerOnly: false,
    requiresMessage: false,
    label: "Confirmer la création dans Quadra",
  },
};

export function canTransition(
  action: TransitionAction,
  status: DossierStatus,
  actor: { id: string; role: Role },
  ownerId: string,
): boolean {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(status)) return false;
  if (actor.role !== rule.role) return false;
  if (rule.ownerOnly && actor.id !== ownerId) return false;
  return true;
}

export function availableActions(
  status: DossierStatus,
  actor: { id: string; role: Role },
  ownerId: string,
): TransitionAction[] {
  return TRANSITION_ACTIONS.filter((a) => canTransition(a, status, actor, ownerId));
}

export const EVENT_TYPES = [
  "created",
  "submitted",
  "resubmitted",
  "info_requested",
  "validated",
  "rejected",
  "quadra_created",
  "document_added",
  "document_removed",
  "comment",
] as const;
export type DossierEventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABELS: Record<DossierEventType, string> = {
  created: "Brouillon créé",
  submitted: "Dossier transmis à l’ADV",
  resubmitted: "Dossier complété et retransmis",
  info_requested: "Complément demandé",
  validated: "Dossier validé par l’ADV",
  rejected: "Dossier refusé",
  quadra_created: "Compte créé dans Quadra",
  document_added: "Pièce ajoutée",
  document_removed: "Pièce retirée",
  comment: "Commentaire",
};
