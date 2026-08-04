"use client";

import type { RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterChip {
  key: string;
  label: string;
}

export interface SortOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chips: FilterChip[];
  onRemoveChip: (key: string) => void;
  sortValue: string;
  sortOptions: SortOption[];
  onSortChange: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

/** Pesquisa à esquerda, chips que se acumulam, ordenação à direita — docs/design-system-v2.md § 4. */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  chips,
  onRemoveChip,
  sortValue,
  sortOptions,
  onSortChange,
  searchInputRef,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 h-11 border-b border-border">
      <Input
        ref={searchInputRef}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder ?? "Pesquisar…"}
        className="w-56"
      />

      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onRemoveChip(chip.key)}
            className="flex items-center gap-1 rounded-sm border border-border-str bg-surface-2 px-2 h-7 font-data text-body-sm text-fg whitespace-nowrap"
          >
            {chip.label}
            <span aria-hidden="true" className="text-fg-subtle">
              ×
            </span>
          </button>
        ))}
      </div>

      <Select value={sortValue} onValueChange={onSortChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
