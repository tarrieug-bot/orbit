"use client";

import { Modal } from "@/components/ui";

/** Modale (Modal du design system) avec l'API des formulaires d'Orbit. */
export function Dialog({ open, onClose, title, description, children, closeLabel, size }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; closeLabel: string; size?: "sm" | "md" | "lg" }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} closeLabel={closeLabel} size={size}>
      {children}
    </Modal>
  );
}
