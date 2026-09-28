import type { MetadataRoute } from "next";
import { SITE_URL } from "~/lib/site";

/** Only the public pages are indexable; everything else sits behind Princeton login. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: [
        "/api/",
        "/explore",
        "/events",
        "/map",
        "/friends",
        "/orgs",
        "/settings",
        "/profile",
        "/onboarding",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
