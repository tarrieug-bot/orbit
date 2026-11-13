import { cn } from "@/lib/utils";

/**
 * Primitives de formulaire (manquantes dans @/components/ui — à reprendre par le design).
 */

const control =
  "w-full rounded-control border border-line bg-surface px-3 text-sm text-ink shadow-soft transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-orbit-400 focus:shadow-glow focus:outline-none disabled:opacity-60";

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-negative" role="alert">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-20 py-2", className)} {...props} />;
}

/** Case à cocher en forme de pastille (sections, réseaux…). */
export function CheckChip({ label, icon, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 shadow-soft transition-all select-none",
        "hover:border-line-strong has-[:checked]:border-orbit-300 has-[:checked]:bg-orbit-50 has-[:checked]:text-orbit-800 has-[:focus-visible]:shadow-glow has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span aria-hidden className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-line-strong bg-surface text-[9px] text-white transition-colors peer-checked:border-orbit-600 peer-checked:bg-orbit-600">
        ✓
      </span>
      {icon}
      {label}
    </label>
  );
}

/** Interrupteur (case à cocher accessible). */
export function Switch({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink-2 select-none", className)}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span aria-hidden className="relative h-5 w-9 rounded-full bg-line-strong transition-colors peer-checked:bg-orbit-600 peer-focus-visible:shadow-glow after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:left-[18px]" />
      {label}
    </label>
  );
}

/** Groupe de boutons radio en segments. */
export function Segmented<T extends string>({ name, value, options, onChange, className }: { name: string; value: T; options: { value: T; label: React.ReactNode }[]; onChange?: (v: T) => void; className?: string }) {
  return (
    <div role="radiogroup" className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-control bg-ink/5 p-1", className)}>
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange?.(o.value)} className="peer sr-only" />
          <span className="flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-ink-2 transition-all peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-soft peer-focus-visible:shadow-glow hover:text-ink">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export const selectClass = cn(control, "h-9 appearance-none pr-8");
