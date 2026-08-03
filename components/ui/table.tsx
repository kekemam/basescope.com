import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Sem cards, sem cantos arredondados, fios de 1px de bordo a bordo — ver
// docs/design-system.md § 4 (Layout) e § 9 (Proibido construir).

export function Table(props: HTMLAttributes<HTMLTableElement>) {
  return <table className="w-full border-collapse font-data text-data" {...props} />;
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-rule hover:bg-hull-lift", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("text-left font-data text-label uppercase tracking-[0.12em] text-graphite px-3 py-2", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 text-bone align-middle", className)} {...props} />;
}
