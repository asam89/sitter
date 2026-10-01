import {
  ABOUT_TEXT_FIELDS,
  MAX_SITTER_AGE,
  MIN_SITTER_AGE,
  type SitterAbout,
} from "@/lib/sitter-about";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function SitterAboutFields({ about }: { about: SitterAbout }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium">
        Age
        <input
          name="age"
          type="number"
          min={MIN_SITTER_AGE}
          max={MAX_SITTER_AGE}
          defaultValue={about.age ?? ""}
          className={inputCls}
        />
      </label>
      {ABOUT_TEXT_FIELDS.map((f) => (
        <label
          key={f.key}
          className={`block text-sm font-medium ${f.multiline ? "sm:col-span-2" : ""}`}
        >
          {f.label}
          {f.multiline ? (
            <textarea
              name={f.key}
              rows={3}
              maxLength={f.max}
              defaultValue={about[f.key] ?? ""}
              placeholder={f.placeholder}
              className={inputCls}
            />
          ) : (
            <input
              name={f.key}
              maxLength={f.max}
              defaultValue={about[f.key] ?? ""}
              placeholder={f.placeholder}
              className={inputCls}
            />
          )}
        </label>
      ))}
    </div>
  );
}
