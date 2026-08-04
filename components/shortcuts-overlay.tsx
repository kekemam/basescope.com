"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

const SHORTCUTS: Array<{ key: string; action: string }> = [
  { key: "⌘K", action: "Command menu" },
  { key: "j / k", action: "Mover entre achados" },
  { key: "Enter", action: "Abrir o achado no side panel" },
  { key: "c", action: "Copiar o SQL do achado" },
  { key: "i", action: "Marcar como intencional" },
  { key: "⌘Enter", action: "Executar scan" },
  { key: "/", action: "Focar a pesquisa" },
  { key: "?", action: "Este ecrã" },
  { key: "Esc", action: "Fechar painel, menu ou overlay" },
];

/** Obrigatório — "sem ele, ninguém descobre os outros" (docs/design-system-v2.md § 6). */
export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "?") setOpen((prev) => !prev);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border-str bg-overlay rounded-md shadow-lg p-4">
          <Dialog.Title className="font-data text-data text-fg mb-3">Atalhos de teclado</Dialog.Title>
          <dl className="flex flex-col gap-2">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <dt className="font-data text-data text-fg-muted">{s.action}</dt>
                <dd className="font-data text-data text-fg border border-border-str rounded-sm px-1.5">{s.key}</dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
