"use client";

import { useState } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";

/** Coluna de checkbox a prefixar às colunas do chamador quando quiser seleção múltipla. */
export function createSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: "select",
    size: 36,
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Selecionar tudo"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Selecionar linha"
      />
    ),
  };
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  activeRowId?: string;
  bulkActions?: (selected: TData[]) => React.ReactNode;
}

/**
 * Cabeçalho sticky, seleção múltipla opcional (prefixa `createSelectionColumn()`
 * às colunas), barra de ações em massa que sobe do fundo quando há seleção —
 * docs/design-system-v2.md § 4 e § 9 (linha de 36px, sem exceções).
 */
export function DataTable<TData>({
  columns,
  data,
  getRowId,
  onRowClick,
  activeRowId,
  bulkActions,
}: DataTableProps<TData>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: getRowId as ((row: TData) => string) | undefined,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

  return (
    <div className="relative flex flex-col">
      <div className="overflow-auto">
        <table className="w-full border-collapse font-data text-data">
          <thead className="sticky top-0 z-10 bg-bg">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-3 h-9 font-data text-[11px] uppercase tracking-[0.08em] text-fg-subtle whitespace-nowrap"
                    style={header.column.columnDef.size ? { width: header.column.columnDef.size } : undefined}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  "h-9 border-b border-border",
                  onRowClick && "cursor-pointer hover:bg-surface-2",
                  (row.getIsSelected() || getRowId?.(row.original) === activeRowId) && "bg-surface-2",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 align-middle text-fg">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bulkActions && selectedRows.length > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-border-str bg-overlay px-4 h-11 shadow-lg">
          <span className="font-data text-body-sm text-fg-muted">{selectedRows.length} selecionados</span>
          {bulkActions(selectedRows)}
        </div>
      )}
    </div>
  );
}
