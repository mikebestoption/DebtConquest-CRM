import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { IconChevronDown } from "../features/layout/icons";

// Shared, app-wide form primitives - every native <select>/checkbox/radio/
// toggle in the CRM should go through these instead of bare HTML controls,
// so the whole app reads as one design system rather than each screen
// falling back to the browser's default (and wildly inconsistent) styling.

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  // Shrinks to fit its content instead of the usual full-width form-field
  // behavior (e.g. a compact filter-bar dropdown). A conditional class,
  // not an appended override - Tailwind's generated CSS order doesn't
  // follow class-string order, so a later "w-auto" in the string can't be
  // trusted to beat an earlier "w-full" of equal specificity.
  fitContent?: boolean;
}

export function Select({ className, children, fitContent, ...props }: SelectProps) {
  return (
    <div className={`relative ${fitContent ? "inline-block" : ""}`}>
      <select
        className={`${fitContent ? "" : "w-full"} appearance-none rounded-md border border-border bg-white px-3 py-2 pr-9 text-sm text-ink outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
      <IconChevronDown width={14} height={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onChange, label, disabled, className }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className ?? ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 ${
          checked ? "border-teal bg-teal" : "border-border bg-white"
        }`}
      >
        {checked && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {label !== undefined && <span className="text-ink">{label}</span>}
    </label>
  );
}

interface RadioProps extends Pick<InputHTMLAttributes<HTMLInputElement>, "name"> {
  checked: boolean;
  onChange: () => void;
  label?: ReactNode;
  disabled?: boolean;
}

export function Radio({ checked, onChange, label, disabled, name }: RadioProps) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="peer sr-only" />
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 ${
          checked ? "border-teal" : "border-border"
        }`}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-teal" />}
      </span>
      {label !== undefined && <span className="text-ink">{label}</span>}
    </label>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  showState?: boolean;
}

export function Switch({ checked, onChange, label, disabled, showState = true }: SwitchProps) {
  return (
    <label className={`flex items-center gap-2 text-sm font-semibold text-ink ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          checked ? "bg-teal" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
      {showState && <span className="font-normal text-muted">{checked ? "Yes" : "No"}</span>}
    </label>
  );
}
