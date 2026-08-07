import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Marca do produto — fita azul dobrada em "S", faceta escura na dobra.
 * public/logo-mark.svg e app/icon.svg são uma aproximação geométrica feita
 * à mão a partir do ícone partilhado, não uma vetorização exata.
 */
export function Logo({ withWordmark = true, className }: { withWordmark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src="/logo-mark.svg" alt="" width={28} height={28} priority />
      {withWordmark && <span className="font-display text-display-l text-fg">BaseScope</span>}
    </span>
  );
}
