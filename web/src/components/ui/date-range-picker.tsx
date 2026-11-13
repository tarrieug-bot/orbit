"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import type { ISODate } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Popover } from "./popover";

export interface DateRangePreset {
  value: string;
  label: string;
  /** groupe d'affichage (ex. « Campagnes ») */
  group?: string;
  /** pastille de couleur (campagne) */
  color?: string | null;
}

export interface DateRangePickerProps {
  presets: DateRangePreset[];
  /** préréglage actif ("custom" pour des dates libres) */
  value: string;
  range: { from: ISODate; to: ISODate };
  /** libellé du bouton (ex. « 30 derniers jours ») */
  label: string;
  /** sous-libellé discret (ex. « 14 oct. – 12 nov. ») */
  detail?: string;
  onPresetChange: (value: string) => void;
  onRangeChange: (range: { from: ISODate; to: ISODate }) => void;
  labels: { custom: string; from: string; to: string; apply: string };
  max?: ISODate;
  align?: "start" | "end";
  className?: string;
}

/** Sélecteur de période : préréglages + dates personnalisées. */
export function DateRangePicker({ presets, value, range, label, detail, onPresetChange, onRangeChange, labels, max, align = "end", className }: DateRangePickerProps) {
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const groups = Array.from(new Set(presets.map((p) => p.group ?? "")));
  return (
    <Popover
      align={align}
      className="w-72"
      trigger={({ open, toggle, props }) => (
        <button
          type="button"
          {...props}
          onClick={() => {
            if (!open) {
              setFrom(range.from);
              setTo(range.to);
            }
            toggle();
          }}
          className={cn(
            "flex h-9 items-center gap-2 rounded-control border border-line bg-surface pr-2.5 pl-3 text-sm font-medium text-ink shadow-soft transition-[border-color,box-shadow] hover:border-line-strong",
            open && "border-orbit-400 shadow-glow",
            className,
          )}
        >
          <CalendarDays size={15} className="text-ink-3" aria-hidden />
          <span className="whitespace-nowrap">{label}</span>
          {detail && <span className="hidden text-xs font-normal whitespace-nowrap text-ink-3 xl:inline">{detail}</span>}
          <ChevronDown size={15} className={cn("text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="max-h-80 overflow-y-auto">
            {groups.map((g) => (
              <div key={g || "_"} className={cn(g && "mt-1 border-t border-line pt-1")}>
                {g && <div className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-wider text-ink-3 uppercase">{g}</div>}
                {presets
                  .filter((p) => (p.group ?? "") === g && p.value !== "custom")
                  .map((p) => {
                    const on = p.value === value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          onPresetChange(p.value);
                          close();
                        }}
                        className={cn("flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-3", on ? "font-semibold text-ink" : "text-ink-2")}
                      >
                        {p.color && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />}
                        <span className="flex-1 truncate">{p.label}</span>
                        {on && <Check size={15} strokeWidth={2.5} className="text-orbit-600" aria-hidden />}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
          <form
            className="mt-1 border-t border-line px-2.5 pt-2.5 pb-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to && from <= to) {
                onRangeChange({ from, to });
                close();
              }
            }}
          >
            <div className={cn("mb-2 text-[10.5px] font-semibold tracking-wider uppercase", value === "custom" ? "text-orbit-600" : "text-ink-3")}>{labels.custom}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-ink-3">
                {labels.from}
                <input type="date" value={from} max={to || max} onChange={(e) => setFrom(e.target.value)} className="mt-0.5 h-8 w-full rounded-[8px] border border-line bg-surface px-2 text-[13px] text-ink focus:border-orbit-400 focus:outline-none" />
              </label>
              <label className="text-[11px] text-ink-3">
                {labels.to}
                <input type="date" value={to} min={from} max={max} onChange={(e) => setTo(e.target.value)} className="mt-0.5 h-8 w-full rounded-[8px] border border-line bg-surface px-2 text-[13px] text-ink focus:border-orbit-400 focus:outline-none" />
              </label>
            </div>
            <button type="submit" className="mt-2.5 h-8 w-full rounded-[8px] bg-ink text-[13px] font-medium text-canvas hover:opacity-90">
              {labels.apply}
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}
