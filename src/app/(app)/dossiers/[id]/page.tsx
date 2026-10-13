import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, History, MessagesSquare, Pencil, Store } from "lucide-react";
import { formatDate, formatDateTime } from "@/domain/dates";
import { DOCUMENT_KINDS, DOCUMENT_LABELS } from "@/domain/documents";
import { FIELD_LABELS, proposeQuadraIdentifier } from "@/domain/dossier";
import { requirePageUser } from "@/server/auth/current";
import { DomainError } from "@/server/errors";
import { getDossierDetail, type DossierDetail } from "@/server/services/dossiers";
import { StatusBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { Callout } from "@/ui/Callout";
import { DocumentItem } from "@/ui/DocumentItem";
import { summaryRows } from "@/ui/DossierSummary";
import { Timeline } from "@/ui/Timeline";
import { AdvActions } from "@/ui/detail/AdvActions";
import { CommentForm } from "@/ui/detail/CommentForm";
import { DeleteDraftButton } from "@/ui/detail/DraftActions";
import { IbanReveal } from "@/ui/detail/IbanReveal";

export const metadata: Metadata = { title: "Dossier" };

const EXCHANGE_TYPES = new Set(["comment", "info_requested", "resubmitted", "rejected", "validated", "quadra_created"]);

function StatusCallout({ d, isOwner }: { d: DossierDetail; isOwner: boolean }) {
  switch (d.status) {
    case "NEEDS_INFO":
      return (
        <Callout
          tone="warning"
          title="Complément demandé par l’ADV"
          action={
            isOwner ? (
              <ButtonLink href={`/dossiers/${d.id}/modifier`} size="sm" variant="secondary">
                Reprendre le dossier
              </ButtonLink>
            ) : undefined
          }
        >
          {d.lastAdvMessage ?? "Consultez l’historique."}
        </Callout>
      );
    case "SUBMITTED":
      return (
        <Callout tone="info" title="En attente de vérification par l’ADV">
          {isOwner ? "Le dossier n’est plus modifiable sauf si l’ADV demande un complément." : "Vérifiez les pièces puis traitez le dossier."}
        </Callout>
      );
    case "VALIDATED":
      return (
        <Callout tone="info" title="Validé par l’ADV — création Quadra en attente">
          Le compte n’existe pas encore dans Quadra tant que l’ADV n’a pas confirmé sa création.
        </Callout>
      );
    case "CREATED_IN_QUADRA":
      return (
        <Callout tone="success" title={`Compte créé dans Quadra : ${d.quadraAccountRef ?? "—"}`}>
          {d.quadraCreatedAt ? `Création confirmée le ${formatDateTime(d.quadraCreatedAt)}.` : undefined}
        </Callout>
      );
    case "REJECTED":
      return (
        <Callout tone="danger" title="Dossier refusé">
          {d.lastAdvMessage ?? undefined}
        </Callout>
      );
    default:
      return null;
  }
}

export default async function DossierPage({ params, searchParams }: PageProps<"/dossiers/[id]">) {
  const user = await requirePageUser(["commercial", "adv"]);
  const { id } = await params;
  const sp = await searchParams;
  let d: DossierDetail;
  try {
    d = await getDossierDetail(user, id);
  } catch (err) {
    if (err instanceof DomainError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  const isOwner = d.ownerId === user.id;
  const isAdv = user.role === "adv";
  const exchanges = d.events.filter((e) => EXCHANGE_TYPES.has(e.type) && e.message).slice().reverse();
  const backHref = isAdv ? "/adv" : "/dossiers";

  const keyDates = [
    { label: "Demande créée", value: formatDate(d.createdAt) },
    d.submittedAt && { label: "Transmis le", value: formatDateTime(d.submittedAt) },
    d.validatedAt && { label: "Validé le", value: formatDateTime(d.validatedAt) },
    d.quadraCreatedAt && { label: "Créé dans Quadra", value: formatDateTime(d.quadraCreatedAt) },
    d.rejectedAt && d.status === "REJECTED" && { label: "Refusé le", value: formatDateTime(d.rejectedAt) },
    { label: "Mis à jour", value: formatDateTime(d.updatedAt) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="mp-content">
      <Link href={backHref} className="mp-textlink" style={{ marginLeft: -4 }}>
        <ChevronLeft aria-hidden /> {isAdv ? "Dossiers à traiter" : "Mes dossiers"}
      </Link>

      <header className="mp-detail-head" style={{ margin: "8px 0 20px" }}>
        <span className="mp-icon-circle" aria-hidden>
          <Store />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="mp-detail-head__title">{d.data.pharmacyName || "Pharmacie sans nom"}</h1>
          <div className="mp-detail-head__meta">
            <StatusBadge status={d.status} />
            <span>{[d.data.postalCode, d.data.city].filter(Boolean).join(" ") || "Ville non renseignée"}</span>
            <span>·</span>
            <span>{d.reference}</span>
          </div>
        </div>
      </header>

      {sp.transmis === "1" && d.status === "SUBMITTED" && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="success" title="Dossier transmis à l’ADV">
            Vous serez informé ici de la validation ou d’une éventuelle demande de complément.
          </Callout>
        </div>
      )}

      <div className="mp-detail">
        <div className="mp-detail__main">
          <div className="mp-order-1">
            <StatusCallout d={d} isOwner={isOwner} />
          </div>

          <section className="mp-card mp-order-3" aria-labelledby="infos">
            <div className="mp-card__head">
              <h2 className="mp-card__title" id="infos" style={{ fontSize: 17 }}>
                Informations
              </h2>
              {d.canEdit && (
                <ButtonLink href={`/dossiers/${d.id}/modifier?etape=1`} variant="secondary" size="sm" icon={<Pencil aria-hidden />}>
                  Modifier
                </ButtonLink>
              )}
            </div>
            <div className="mp-card__body">
              <dl className="mp-dl">
                {summaryRows(d.data).map((r) => (
                  <div key={r.label} style={{ display: "contents" }}>
                    <dt>{r.label}</dt>
                    <dd className={r.value ? undefined : "mp-dl__empty"}>
                      {r.label === FIELD_LABELS.iban && d.data.iban && isAdv ? <IbanReveal iban={d.data.iban} /> : r.value || "Non renseigné"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="mp-card mp-order-4" aria-labelledby="pieces">
            <div className="mp-card__head">
              <h2 className="mp-card__title" id="pieces" style={{ fontSize: 17 }}>
                <FileText aria-hidden style={{ width: 20, height: 20, color: "var(--mp-primary)" }} /> Pièces jointes
              </h2>
              {d.canEdit && (
                <ButtonLink href={`/dossiers/${d.id}/modifier?etape=2`} variant="secondary" size="sm" icon={<Pencil aria-hidden />}>
                  Gérer
                </ButtonLink>
              )}
            </div>
            <div className="mp-card__body mp-stack mp-stack--lg">
              {DOCUMENT_KINDS.map((k) => {
                const list = d.documents.filter((x) => x.kind === k);
                return (
                  <div key={k} className="mp-stack">
                    <h3 className="mp-subsection-title" style={{ margin: 0 }}>
                      {DOCUMENT_LABELS[k]}
                    </h3>
                    {list.length ? (
                      list.map((doc, i) => <DocumentItem key={doc.id} doc={doc} page={list.length > 1 ? i + 1 : undefined} />)
                    ) : (
                      <p className="mp-small mp-muted">Aucun fichier.</p>
                    )}
                  </div>
                );
              })}
              {d.removedDocuments.length > 0 && (
                <details>
                  <summary className="mp-small mp-muted" style={{ cursor: "pointer", minHeight: 32 }}>
                    {d.removedDocuments.length} pièce(s) retirée(s) par le commercial
                  </summary>
                  <div className="mp-stack" style={{ marginTop: 8 }}>
                    {d.removedDocuments.map((doc) => (
                      <DocumentItem key={doc.id} doc={doc} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </section>

          <section className="mp-card mp-order-5" aria-labelledby="echanges">
            <div className="mp-card__head">
              <h2 className="mp-card__title" id="echanges" style={{ fontSize: 17 }}>
                <MessagesSquare aria-hidden style={{ width: 20, height: 20, color: "var(--mp-primary)" }} /> Commentaires et compléments
              </h2>
            </div>
            <div className="mp-card__body mp-stack mp-stack--lg">
              {exchanges.length ? (
                <Timeline events={exchanges} />
              ) : (
                <p className="mp-small mp-muted">Aucun échange pour le moment.</p>
              )}
              {d.canComment && <CommentForm dossierId={d.id} />}
            </div>
          </section>
        </div>

        <aside className="mp-detail__aside">
          <section className="mp-card mp-card--padded mp-stack mp-order-6" aria-labelledby="statut">
            <h2 className="mp-section-title" id="statut">
              Statut
            </h2>
            <div>
              <StatusBadge status={d.status} />
            </div>
            <dl className="mp-dl">
              <dt>Commercial</dt>
              <dd>{d.ownerName}</dd>
              {keyDates.map((k) => (
                <div key={k.label} style={{ display: "contents" }}>
                  <dt>{k.label}</dt>
                  <dd>{k.value}</dd>
                </div>
              ))}
              {d.quadraAccountRef && (
                <>
                  <dt>Compte Quadra</dt>
                  <dd className="mp-mono">{d.quadraAccountRef}</dd>
                </>
              )}
            </dl>
            {isOwner && d.canEdit && (
              <div className="mp-stack">
                <ButtonLink href={`/dossiers/${d.id}/modifier`} block>
                  {d.status === "NEEDS_INFO" ? "Reprendre le dossier" : "Continuer le brouillon"}
                </ButtonLink>
                {d.status === "DRAFT" && !d.submittedAt && <DeleteDraftButton dossierId={d.id} />}
              </div>
            )}
          </section>

          {isAdv && (
            <section className="mp-card mp-card--padded mp-stack mp-order-2" aria-labelledby="traitement">
              <h2 className="mp-section-title" id="traitement">
                Traitement ADV
              </h2>
              <AdvActions
                dossierId={d.id}
                status={d.status}
                actions={d.actions}
                proposedIdentifier={proposeQuadraIdentifier(d.data.ownerName, d.data.postalCode)}
                prospectRef={d.data.quadraProspectRef || null}
              />
            </section>
          )}

          <section className="mp-card mp-card--padded mp-stack mp-order-7" aria-labelledby="historique">
            <h2 className="mp-section-title" id="historique" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <History aria-hidden style={{ width: 18, height: 18 }} /> Historique
            </h2>
            <Timeline events={d.events} showMessages={false} />
          </section>
        </aside>
      </div>
    </div>
  );
}
