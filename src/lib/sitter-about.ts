// Parent-facing "About me" fields on a SitterProfile, shared by the sitter's
// own editor, the Admin editor and the public profile page.

export const ABOUT_TEXT_FIELDS = [
  {
    key: "education",
    label: "Education",
    placeholder: "e.g. Bachelor of Education, working toward OCT licence",
    max: 200,
    multiline: false,
  },
  {
    key: "experience",
    label: "Childcare experience",
    placeholder:
      "Where you've cared for children, for how long, and anything special (e.g. special needs, infants)",
    max: 1000,
    multiline: true,
  },
  {
    key: "agesCaredFor",
    label: "Ages cared for",
    placeholder: "e.g. 1 to 12 years",
    max: 200,
    multiline: false,
  },
  {
    key: "languages",
    label: "Languages",
    placeholder: "e.g. English, Urdu, Arabic",
    max: 200,
    multiline: false,
  },
  {
    key: "activities",
    label: "Favourite activities with kids",
    placeholder: "e.g. colouring, painting, board games, reading",
    max: 500,
    multiline: true,
  },
] as const;

export type AboutTextKey = (typeof ABOUT_TEXT_FIELDS)[number]["key"];

export type SitterAbout = { age: number | null } & Record<
  AboutTextKey,
  string | null
>;

export const MIN_SITTER_AGE = 14;
export const MAX_SITTER_AGE = 99;

export function pickAbout(sp: SitterAbout): SitterAbout {
  return {
    age: sp.age,
    education: sp.education,
    experience: sp.experience,
    agesCaredFor: sp.agesCaredFor,
    languages: sp.languages,
    activities: sp.activities,
  };
}

export function hasAbout(a: SitterAbout): boolean {
  return a.age !== null || ABOUT_TEXT_FIELDS.some((f) => Boolean(a[f.key]));
}

export function parseAbout(
  fd: FormData,
): { ok: true; data: SitterAbout } | { ok: false; error: string } {
  const text = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const ageRaw = text("age");
  let age: number | null = null;
  if (ageRaw) {
    age = Number(ageRaw);
    if (
      !Number.isInteger(age) ||
      age < MIN_SITTER_AGE ||
      age > MAX_SITTER_AGE
    ) {
      return {
        ok: false,
        error: `Age must be a whole number between ${MIN_SITTER_AGE} and ${MAX_SITTER_AGE}.`,
      };
    }
  }
  const data: SitterAbout = {
    age,
    education: null,
    experience: null,
    agesCaredFor: null,
    languages: null,
    activities: null,
  };
  for (const f of ABOUT_TEXT_FIELDS) {
    const v = text(f.key);
    if (v.length > f.max) {
      return {
        ok: false,
        error: `${f.label} is too long (max ${f.max} characters).`,
      };
    }
    data[f.key] = v || null;
  }
  return { ok: true, data };
}
