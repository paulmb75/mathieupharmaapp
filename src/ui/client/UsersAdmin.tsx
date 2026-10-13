"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserPlus } from "lucide-react";
import { ROLE_LABELS, ROLES, type Role } from "@/domain/roles";
import { formatDate } from "@/domain/dates";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { Callout } from "../Callout";
import { Field, Select, TextInput } from "../Field";
import { Dialog } from "./Dialog";
import { apiFetch, errorMessage } from "./api";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  lockedUntil: Date | null;
  createdAt: Date;
};

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function UsersAdmin({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", role: "commercial" as Role, temporaryPassword: "" });
  const [tempPassword, setTempPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>, success: string) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "PATCH", json: body });
      setNotice(success);
      router.refresh();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }

  async function create() {
    setPending(true);
    setError(null);
    try {
      await apiFetch("/api/admin/users", { method: "POST", json: form });
      setNotice(`Compte créé pour ${form.fullName}. Communiquez-lui le mot de passe temporaire par un canal sûr.`);
      setCreating(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mp-stack mp-stack--lg">
      <div>
        <Button
          icon={<UserPlus aria-hidden />}
          onClick={() => {
            setForm({ fullName: "", email: "", role: "commercial", temporaryPassword: generatePassword() });
            setError(null);
            setCreating(true);
          }}
        >
          Ajouter un utilisateur
        </Button>
      </div>
      {notice && <Callout tone="success" title={notice} />}
      {error && !creating && !resetFor && <Callout tone="danger" title={error} />}

      <div className="mp-table-wrap">
        <table className="mp-table">
          <thead>
            <tr>
              <th scope="col">Utilisateur</th>
              <th scope="col">Rôle</th>
              <th scope="col">État</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
              return (
                <tr key={u.id} style={{ cursor: "default" }}>
                  <td>
                    <div className="mp-table__primary">{u.fullName}</div>
                    <div className="mp-table__sub">{u.email}</div>
                    <div className="mp-table__sub">Créé le {formatDate(u.createdAt)}</div>
                  </td>
                  <td style={{ minWidth: 190 }}>
                    <label className="mp-visually-hidden" htmlFor={`role-${u.id}`}>
                      Rôle de {u.fullName}
                    </label>
                    <Select
                      id={`role-${u.id}`}
                      value={u.role}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        if (window.confirm(`Attribuer le rôle « ${ROLE_LABELS[role]} » à ${u.fullName} ? Ses sessions seront fermées.`)) {
                          void patch(u.id, { role }, "Rôle mis à jour.");
                        } else {
                          e.target.value = u.role;
                        }
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <div className="mp-row mp-row--wrap">
                      <Badge tone={u.active ? "success" : "neutral"} size="sm">
                        {u.active ? "Actif" : "Désactivé"}
                      </Badge>
                      {u.mustChangePassword && (
                        <Badge tone="warning" size="sm">
                          Mot de passe temporaire
                        </Badge>
                      )}
                      {locked && (
                        <Badge tone="danger" size="sm">
                          Verrouillé
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="mp-row mp-row--wrap">
                      <Button
                        size="sm"
                        variant="neutral"
                        icon={<KeyRound aria-hidden />}
                        onClick={() => {
                          setTempPassword(generatePassword());
                          setError(null);
                          setResetFor(u);
                        }}
                      >
                        Réinitialiser
                      </Button>
                      {u.id !== currentUserId && (
                        <Button
                          size="sm"
                          variant={u.active ? "danger-outline" : "secondary"}
                          onClick={() => {
                            if (window.confirm(`${u.active ? "Désactiver" : "Réactiver"} le compte de ${u.fullName} ?`)) {
                              void patch(u.id, { active: !u.active }, u.active ? "Compte désactivé." : "Compte réactivé.");
                            }
                          }}
                        >
                          {u.active ? "Désactiver" : "Réactiver"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={creating} onClose={() => !pending && setCreating(false)} title="Ajouter un utilisateur">
        {error && <Callout tone="danger" title={error} />}
        <Field id="u-name" label="Nom complet" plainLabel required>
          <TextInput id="u-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="off" />
        </Field>
        <Field id="u-email" label="Adresse e-mail professionnelle" plainLabel required>
          <TextInput id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
        </Field>
        <Field id="u-role" label="Rôle" plainLabel required>
          <Select id="u-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="u-pass" label="Mot de passe temporaire" plainLabel required hint="À changer à la première connexion. 12 caractères minimum.">
          <TextInput id="u-pass" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} className="mp-mono" autoComplete="off" />
        </Field>
        <div className="mp-dialog__actions">
          <Button variant="neutral" onClick={() => setCreating(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={create} loading={pending} disabled={!form.fullName || !form.email || form.temporaryPassword.length < 12}>
            Créer le compte
          </Button>
        </div>
      </Dialog>

      <Dialog open={!!resetFor} onClose={() => setResetFor(null)} title="Réinitialiser le mot de passe">
        {error && <Callout tone="danger" title={error} />}
        <p className="mp-small">
          Nouveau mot de passe temporaire pour <strong>{resetFor?.fullName}</strong>. Ses sessions ouvertes seront fermées et le
          compte déverrouillé.
        </p>
        <Field id="reset-pass" label="Mot de passe temporaire" plainLabel>
          <TextInput id="reset-pass" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className="mp-mono" autoComplete="off" />
        </Field>
        <div className="mp-dialog__actions">
          <Button variant="neutral" onClick={() => setResetFor(null)}>
            Annuler
          </Button>
          <Button
            disabled={tempPassword.length < 12}
            onClick={async () => {
              if (resetFor && (await patch(resetFor.id, { temporaryPassword: tempPassword }, `Mot de passe réinitialisé pour ${resetFor.fullName}.`))) {
                setResetFor(null);
              }
            }}
          >
            Réinitialiser
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
