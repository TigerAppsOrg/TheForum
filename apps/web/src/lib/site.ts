import { env } from "~/env";

/** Canonical origin for metadata, sitemap and robots. */
export const SITE_URL = (env.NEXT_PUBLIC_SITE_URL ?? "https://forum.tigerapps.org").replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "The Forum";

export const SITE_TITLE = "The Forum — Princeton Campus Events";

export const SITE_DESCRIPTION =
  "Every Princeton campus event in one feed — personalized around your interests, your friends, and where you are on campus. Built by TigerApps.";

export const CONTACT_EMAIL = "it.admin@tigerapps.org";
