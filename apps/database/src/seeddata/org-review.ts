import { orgCategoryEnum, type organizations } from "../schema";

type Organization = typeof organizations.$inferInsert;

const examples = [
  ["Academic Advising", "academics", "University Office"],
  ["AccessAbility Center", "politics", "University Office"],
  ["Active Minds", "politics", "Student Organization"],
  ["Office of International Programs", "culture", "University Office"],
  ["Research Computing", "academics", "University Office"],
  ["Community Service Coalition", "community service", "Student Organization"],
  ["Social Activities Council", "social event", "Student Organization"],
  [
    "International Association for Interdisciplinary Research, Community Engagement, and Student Leadership",
    "academics",
    "Student Organization",
  ],
] as const;

// Deliberately fictional, namespaced data; no imported organizations are changed.
export const reviewOrganizations: Organization[] = Array.from({ length: 312 }, (_, i) => {
  const example = examples[i];
  const category = example?.[1] ?? orgCategoryEnum.enumValues[i % 10];
  const number = String(i + 1).padStart(3, "0");
  const name =
    example?.[0] ?? `${String.fromCharCode(65 + (i % 26))} ${category} Collective ${number}`;
  const description =
    i % 6 === 0
      ? null
      : i % 6 === 1
        ? ""
        : i % 6 === 2
          ? "A student community."
          : i % 6 === 3
            ? "We bring students together for weekly workshops, peer mentoring, performances, and community projects. Everyone is welcome, whether you are trying something new or bringing years of experience. Join our open meetings to meet collaborators, learn practical skills, and help shape next semester's activities. ".repeat(
                3,
              )
            : `Explore ${category} through open meetings, projects, and campus events.`;
  return {
    externalId: `seed:tig-308:org:${number}`,
    source: "seed",
    name: `${name} [TIG-308 demo]`,
    category,
    description,
    groupType: example?.[2] ?? "Student Organization",
    acronym: i % 4 === 0 ? `D${number}` : null,
    logoUrl: i % 3 === 0 ? null : `/seed/tig-308-${i % 3 === 1 ? "simple" : "detailed"}.svg`,
    memberCount: i % 5 === 0 ? null : (i * 17) % 1200,
    updatedAt: new Date(Date.UTC(2026, 0, 1 + (i % 90))),
  };
});
