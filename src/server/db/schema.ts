import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ROLES } from "../../domain/roles";
import { EVENT_TYPES, STATUSES } from "../../domain/status";
import { DOCUMENT_KINDS } from "../../domain/documents";

export const roleEnum = pgEnum("user_role", ROLES);
export const statusEnum = pgEnum("dossier_status", STATUSES);
export const documentKindEnum = pgEnum("document_kind", DOCUMENT_KINDS);
export const eventTypeEnum = pgEnum("dossier_event_type", EVENT_TYPES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: roleEnum("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  ...timestamps,
});

/** Sessions serveur : seule l'empreinte SHA-256 du jeton est stockée. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Numérotation atomique des références de dossiers (OUV-00001…), gérée par PostgreSQL. */
export const dossierReferenceSeq = pgSequence("dossier_reference_seq", { startWith: 1 });

export const dossiers = pgTable(
  "dossiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference")
      .notNull()
      .unique()
      .default(sql`'OUV-' || lpad(nextval('dossier_reference_seq')::text, 5, '0')`),
    status: statusEnum("status").notNull().default("DRAFT"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    /** Clé d'idempotence fournie par le client pour éviter les créations en double. */
    creationKey: text("creation_key").unique(),
    /** Verrou optimiste : incrémenté à chaque enregistrement. */
    version: integer("version").notNull().default(1),

    cipCode: text("cip_code"),
    siret: text("siret"),
    ownerName: text("owner_name"),
    pharmacyName: text("pharmacy_name"),
    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    phone: text("phone"),
    email: text("email"),
    groupementType: text("groupement_type"),
    groupementName: text("groupement_name"),
    paymentMethod: text("payment_method"),
    /** Donnée bancaire sensible : jamais journalisée, masquée dans les listes. */
    iban: text("iban"),
    quadraProspectRef: text("quadra_prospect_ref"),
    comments: text("comments"),

    /** Référence du compte saisie par l'ADV après création manuelle dans Quadra. */
    quadraAccountRef: text("quadra_account_ref"),
    lastAdvMessage: text("last_adv_message"),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    quadraCreatedAt: timestamp("quadra_created_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("dossiers_owner_idx").on(t.ownerId),
    index("dossiers_status_idx").on(t.status),
    index("dossiers_updated_idx").on(t.updatedAt),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: uuid("dossier_id")
      .notNull()
      .references(() => dossiers.id, { onDelete: "cascade" }),
    kind: documentKindEnum("kind").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Retrait logique : la pièce reste consultable dans l'historique par l'ADV. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedById: uuid("removed_by_id").references(() => users.id),
  },
  (t) => [index("documents_dossier_idx").on(t.dossierId)],
);

export const dossierEvents = pgTable(
  "dossier_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: uuid("dossier_id")
      .notNull()
      .references(() => dossiers.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    type: eventTypeEnum("type").notNull(),
    fromStatus: statusEnum("from_status"),
    toStatus: statusEnum("to_status"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dossier_events_dossier_idx").on(t.dossierId, t.createdAt)],
);

export type UserRow = typeof users.$inferSelect;
export type DossierRow = typeof dossiers.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type DossierEventRow = typeof dossierEvents.$inferSelect;
