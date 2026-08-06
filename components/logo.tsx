import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Marca do produto. O ficheiro public/logo-mark.svg é uma aproximação
 * geométrica feita à mão a partir da imagem partilhada (fita azul dobrada
 * em "S", faceta escura na dobra) — não uma vetorização exata. Substituir
 * por um export real (SVG/Figma) assim que disponível.
 */
export function Logo({ withWordmark = true, className }: { withWordmark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src="/logo-mark.svg" alt="" width={24} height={24} priority />
      {withWordmark && <span className="font-display text-display-l text-fg">BaseScope</span>}
    </span>
  );
}
