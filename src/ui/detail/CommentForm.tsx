"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../Button";
import { Callout } from "../Callout";
import { TextArea } from "../Field";
import { apiFetch, errorMessage } from "../client/api";

export function CommentForm({ dossierId }: { dossierId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/dossiers/${dossierId}/comments`, { method: "POST", json: { message: message.trim() } });
      setMessage("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={send} className="mp-stack">
      {error && <Callout tone="danger" title={error} />}
      <label htmlFor="comment" className="mp-visually-hidden">
        Ajouter un commentaire
      </label>
      <TextArea id="comment" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} placeholder="Ajouter un commentaire…" style={{ minHeight: 80 }} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" size="sm" loading={pending} disabled={!message.trim()}>
          Publier
        </Button>
      </div>
    </form>
  );
}
