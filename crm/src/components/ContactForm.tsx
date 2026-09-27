import { SOURCES, SOURCE_LABELS, TIERS, TIER_LABELS } from "@/lib/domain";
import type { Contact } from "@/lib/queries";

export function ContactForm({
  action,
  contact,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  contact?: Contact;
  submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <Field label="Name">
        <input
          name="name"
          required
          defaultValue={contact?.name}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={contact?.email ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={contact?.phone ?? ""} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tier">
          <select name="tier" defaultValue={contact?.tier ?? "standard"} className={inputClass}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select
            name="source"
            defaultValue={contact?.source ?? "organic"}
            className={inputClass}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Deal Value (GBP)">
        <input
          name="value_gbp"
          type="number"
          min="0"
          step="1"
          defaultValue={contact?.value_gbp ?? ""}
          className={inputClass}
        />
      </Field>

      <button
        type="submit"
        className="rounded-lg bg-accent-base px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent"
      >
        {submitLabel}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-muted">{label}</label>
      {children}
    </div>
  );
}
