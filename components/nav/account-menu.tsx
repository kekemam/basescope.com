"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOut } from "@/lib/auth/actions";

function initialsFor(email: string): string {
  const name = email.split("@")[0] ?? "?";
  const parts = name.split(/[._-]/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}` : name.slice(0, 2);
  return letters.toUpperCase();
}

export function AccountMenu({ email }: { email: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Conta"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-bg font-data text-body-sm font-semibold text-accent hover:opacity-80"
        >
          {initialsFor(email)}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-56 border border-border-str bg-overlay rounded-md shadow-lg py-1"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="font-data text-body-sm text-fg truncate">{email}</p>
          </div>

          <div className="flex items-center justify-between px-3 h-9">
            <span className="font-prosa text-body-sm text-fg-muted">Tema</span>
            <ThemeToggle />
          </div>

          <div className="border-t border-border py-1">
            <form action={signOut}>
              <button
                type="submit"
                className="w-full text-left px-3 h-9 flex items-center font-prosa text-body-sm text-crit hover:bg-surface-2 outline-none"
              >
                Terminar sessão
              </button>
            </form>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
