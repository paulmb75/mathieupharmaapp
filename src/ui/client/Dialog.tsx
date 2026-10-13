"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Fenêtre modale native (<dialog>) : focus piégé et touche Échap gérés par le navigateur. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="mp-dialog"
      aria-labelledby="mp-dialog-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="mp-dialog__inner">
          <h2 className="mp-dialog__title" id="mp-dialog-title">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
