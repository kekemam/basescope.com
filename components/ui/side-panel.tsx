"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";

/**
 * Sheet de 480px que entra da direita — substitui todos os modais exceto
 * confirmação de ação destrutiva (docs/design-system-v2.md § 4 e § 7).
 * `Dialog.Root` do Radix trata do foco/scroll-lock/Esc de graça.
 */
export function SidePanel({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-full sm:w-[480px] flex-col border-l border-border-str bg-overlay shadow-lg outline-none",
            className,
          )}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SidePanelHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-border px-4 h-12 shrink-0">{children}</div>;
}

export function SidePanelBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>;
}

export function SidePanelFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 border-t border-border px-4 h-14 shrink-0">{children}</div>;
}
