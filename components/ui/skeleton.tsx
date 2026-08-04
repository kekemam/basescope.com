import { cn } from "@/lib/cn";

/** Bloco estático em --surface-2, sem brilho a varrer — docs/design-system-v2.md § 10. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-surface-2 rounded-sm", className)} />;
}

/** 8 linhas com as alturas/larguras de coluna reais de uma DataTable — usa-se em vez de spinner. */
export function TableSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 8 }).map((_, row) => (
        <div key={row} className="flex items-center gap-3 h-9 border-b border-border px-3">
          {Array.from({ length: columns }).map((__, col) => (
            <Skeleton key={col} className={cn("h-3", col === 0 ? "w-16" : "flex-1 max-w-[180px]")} />
          ))}
        </div>
      ))}
    </div>
  );
}
