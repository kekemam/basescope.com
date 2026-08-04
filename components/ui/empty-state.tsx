/** Título + uma linha de explicação + botão primário opcional. Sem ilustração — docs/design-system-v2.md § 4. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="font-prosa text-body text-fg">{title}</p>
      {description && <p className="font-prosa text-body text-fg-muted max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
