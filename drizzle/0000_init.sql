CREATE TYPE "public"."document_kind" AS ENUM('KBIS', 'RIB');--> statement-breakpoint
CREATE TYPE "public"."dossier_event_type" AS ENUM('created', 'submitted', 'resubmitted', 'info_requested', 'validated', 'rejected', 'quadra_created', 'document_added', 'document_removed', 'comment');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('commercial', 'adv', 'admin');--> statement-breakpoint
CREATE TYPE "public"."dossier_status" AS ENUM('DRAFT', 'SUBMITTED', 'NEEDS_INFO', 'VALIDATED', 'CREATED_IN_QUADRA', 'REJECTED');--> statement-breakpoint
CREATE SEQUENCE "public"."dossier_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_id" uuid,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "dossier_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"type" "dossier_event_type" NOT NULL,
	"from_status" "dossier_status",
	"to_status" "dossier_status",
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text DEFAULT 'OUV-' || lpad(nextval('dossier_reference_seq')::text, 5, '0') NOT NULL,
	"status" "dossier_status" DEFAULT 'DRAFT' NOT NULL,
	"owner_id" uuid NOT NULL,
	"creation_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"cip_code" text,
	"siret" text,
	"owner_name" text,
	"pharmacy_name" text,
	"address" text,
	"postal_code" text,
	"city" text,
	"phone" text,
	"email" text,
	"groupement_type" text,
	"groupement_name" text,
	"payment_method" text,
	"iban" text,
	"quadra_prospect_ref" text,
	"comments" text,
	"quadra_account_ref" text,
	"last_adv_message" text,
	"submitted_at" timestamp with time zone,
	"validated_at" timestamp with time zone,
	"quadra_created_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossiers_reference_unique" UNIQUE("reference"),
	CONSTRAINT "dossiers_creation_key_unique" UNIQUE("creation_key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_removed_by_id_users_id_fk" FOREIGN KEY ("removed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_events" ADD CONSTRAINT "dossier_events_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_events" ADD CONSTRAINT "dossier_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_dossier_idx" ON "documents" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "dossier_events_dossier_idx" ON "dossier_events" USING btree ("dossier_id","created_at");--> statement-breakpoint
CREATE INDEX "dossiers_owner_idx" ON "dossiers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "dossiers_status_idx" ON "dossiers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dossiers_updated_idx" ON "dossiers" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");