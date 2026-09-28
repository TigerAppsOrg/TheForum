import { getZonedParts } from "~/lib/date-format";

/**
 * Option lists shared by onboarding and settings.
 *
 * Values must match the `event_tag` / `campus_region` pgEnums in
 * apps/database/src/schema. They're inlined because these are client
 * components and can't import the server-only database package.
 */

export const INTEREST_OPTIONS = [
  { value: "free food", label: "Free Food" },
  { value: "career", label: "Career & Recruiting" },
  { value: "research", label: "Research" },
  { value: "academics", label: "Academics" },
  { value: "tech", label: "Tech & Coding" },
  { value: "stem", label: "Science & Engineering" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "politics", label: "Politics & Advocacy" },
  { value: "visual arts", label: "Art & Design" },
  { value: "performing arts", label: "Theater & Performance" },
  { value: "music", label: "Music" },
  { value: "literature", label: "Literature & Writing" },
  { value: "culture", label: "Culture & Identity" },
  { value: "religion", label: "Faith & Religion" },
  { value: "community service", label: "Community Service" },
  { value: "sustainability", label: "Sustainability" },
  { value: "wellness", label: "Wellness & Mental Health" },
  { value: "athletics", label: "Fitness & Sports" },
  { value: "outdoors", label: "Outdoor & Adventure" },
  { value: "gaming", label: "Gaming & Esports" },
  { value: "social event", label: "Social Events" },
  { value: "speaker event", label: "Speakers & Talks" },
] as const;

const INTEREST_VALUES = new Set<string>(INTEREST_OPTIONS.map((o) => o.value));

export function isInterestValue(value: string) {
  return INTEREST_VALUES.has(value);
}

export function interestLabel(value: string) {
  return INTEREST_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const CAMPUS_REGION_OPTIONS = [
  { value: "central", label: "Central Campus", desc: "Nassau Hall, Frist, 1879" },
  { value: "east", label: "Science Area", desc: "Jadwin, Friend, EQuad" },
  { value: "south", label: "Prospect Ave", desc: "Eating clubs, Terrace" },
  { value: "west", label: "Residential Colleges", desc: "Butler, Whitman, Yeh …" },
  { value: "north", label: "Arts Corridor", desc: "McCarter, Lewis Center" },
  { value: "off-campus", label: "Athletics Area", desc: "Lenz, DeNunzio, Dillon" },
] as const;

const REGION_VALUES = new Set<string>(CAMPUS_REGION_OPTIONS.map((o) => o.value));

export function isRegionValue(value: string) {
  return REGION_VALUES.has(value);
}

/**
 * Undergraduate class years currently on campus, plus graduate/other.
 *
 * Princeton's year turns over at Commencement (late May), so from June on the
 * rising seniors are next year's class. In September 2026 this yields
 * 2027–2030; hardcoding the list meant it silently went stale every year.
 */
export function getClassYearOptions(now = new Date()): string[] {
  const { year, month } = getZonedParts(now);
  const seniorClass = month >= 6 ? year + 1 : year;
  const undergrad = Array.from({ length: 4 }, (_, i) => String(seniorClass + i));
  return [...undergrad, "Grad", "Other"];
}

/** Keeps a previously saved value selectable after the list has rolled over. */
export function withCurrentOption(options: string[], current: string | null | undefined) {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

/** "'27" for a class year, "Grad" for grad students, nothing otherwise. */
export function classYearShort(value: string | null | undefined) {
  if (!value) return null;
  if (/^\d{4}$/.test(value)) return `'${value.slice(-2)}`;
  if (value === "Grad") return "Grad";
  return null;
}

export function classYearLabel(value: string) {
  if (value === "Grad") return "Graduate student";
  if (value === "Other") return "Other / not a student";
  return `Class of ${value}`;
}
