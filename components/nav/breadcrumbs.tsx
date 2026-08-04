import Link from "next/link";
import { cn } from "@/lib/cn";

export interface Crumb {
  label: string;
  href?: string;
}

/** Cada nível clicável exceto o último — docs/design-system-v2.md § 3. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 font-data text-data">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span className="text-fg-subtle">/</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-fg-muted hover:text-fg">
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? "text-fg" : "text-fg-muted")}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
