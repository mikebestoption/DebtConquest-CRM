import { useState, type ReactNode } from "react";
import { IconChevronDown } from "../layout/icons";
import { US_STATES } from "./usStates";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-gray-400 focus:border-teal focus:ring-2 focus:ring-ring";

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-card border border-border bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-ink">{title}</span>
        <IconChevronDown className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} width={16} height={16} />
      </button>
      {open && <div className="border-t border-border px-5 py-5">{children}</div>}
    </div>
  );
}

export type FieldType = "text" | "email" | "number" | "date" | "textarea" | "select" | "readonly";

export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: readonly string[];
  required?: boolean;
  placeholder?: string;
  span?: 1 | 2;
}

type FieldValues = Record<string, string | number | boolean | null | undefined>;

export function FieldGrid({
  fields,
  values,
  onChange,
}: {
  fields: readonly FieldDef[];
  values: FieldValues;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={f.span === 2 ? "sm:col-span-2" : undefined}>
          <label className="mb-1 block text-sm text-ink">
            {f.label}
            {f.required && <span className="text-error"> *</span>}
          </label>
          <FieldInput field={f} value={values[f.key]} onChange={(v) => onChange(f.key, v)} />
        </div>
      ))}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: string | number | boolean | null | undefined; onChange: (v: string) => void }) {
  const strValue = value === null || value === undefined ? "" : String(value);

  if (field.type === "readonly") {
    return <p className="pt-2 text-sm text-muted">{strValue || "NA"}</p>;
  }
  if (field.type === "textarea") {
    return (
      <textarea
        className={INPUT_CLASS}
        rows={3}
        placeholder={field.placeholder}
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select className={INPUT_CLASS} value={strValue} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type === "date" ? "date" : field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
      className={INPUT_CLASS}
      placeholder={field.placeholder}
      value={strValue}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextInput({
  label,
  value,
  onChange,
  required,
  type = "text",
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: "text" | "email" | "date" | "number";
  suffix?: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-ink">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      <div className="flex items-center gap-2">
        <input type={type} className={INPUT_CLASS} value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix}
      </div>
    </div>
  );
}

export function CheckboxLabel({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
      <input type="checkbox" className="accent-teal" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function StateSelect({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-ink">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      <select className={INPUT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {US_STATES.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-teal" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      <span className="font-normal text-muted">{checked ? "Yes" : "No"}</span>
    </label>
  );
}

// Header pill dropdowns (Queue/Status/Program/Source/Assigned Rep) - a
// native <select> styled to look like the filled rounded-pill badges in the
// reference design, chevron drawn on top since a styled <select> can't show
// its own custom arrow.
export function PillSelect({
  value,
  onChange,
  options,
  placeholder = "—",
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative inline-block">
      <select
        className="appearance-none rounded-full bg-teal py-1 pl-3 pr-7 text-xs font-semibold text-white outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {!value && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-white" width={12} height={12} />
    </div>
  );
}

export { INPUT_CLASS };
