"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** valeur de tri ; colonne non triable si absent */
  sortValue?: (row: T) => number | string | null;
  align?: "left" | "right" | "center";
  /** largeur CSS (ex. "30%", "120px") */
  width?: string;
  /** masquée sous ce point de rupture */
  hideBelow?: "sm" | "md" | "lg";
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  defaultSort?: { key: string; direction: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  dense?: boolean;
  /** contenu si aucune ligne */
  empty?: React.ReactNode;
  /** ligne de pied (totaux) */
  footer?: React.ReactNode;
  /** légende accessible */
  caption?: string;
  className?: string;
}

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const;

/** Tableau triable (clic sur l'en-tête), chiffres tabulaires, survol de ligne. */
export function DataTable<T>({ columns, rows, getRowId, defaultSort, onRowClick, dense, empty, footer, caption, className }: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, direction: s.direction === "desc" ? "asc" : "desc" } : { key, direction: "desc" }));

  const pad = dense ? "px-3 py-2" : "px-4 py-3";
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-separate border-spacing-0 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const align = c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={{ width: c.width }}
                  aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("sticky top-0 z-[1] border-b border-line bg-surface-2 text-[11.5px] font-semibold tracking-wide whitespace-nowrap text-ink-3 uppercase first:rounded-tl-[10px] last:rounded-tr-[10px]", pad, dense && "py-2", align, c.hideBelow && HIDE[c.hideBelow])}
                >
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 uppercase hover:text-ink", active && "text-ink", c.align === "right" && "flex-row-reverse")}>
                      {c.header}
                      {active ? sort!.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ChevronsUpDown size={12} className="opacity-50" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={getRowId(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn("group transition-colors hover:bg-surface-2", onRowClick && "cursor-pointer")}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn("border-b border-line/70 text-ink group-last:border-b-0", pad, c.align === "right" && "text-right tabular", c.align === "center" && "text-center", c.hideBelow && HIDE[c.hideBelow], c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {!sorted.length && empty && (
            <tr>
              <td colSpan={columns.length} className="p-0">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
        {footer && <tfoot className="bg-surface-2 font-semibold">{footer}</tfoot>}
      </table>
    </div>
  );
}
