import type { MetadataRoute } from "next";
import { SITE_URL } from "~/lib/site";

/** The landing page is the only public, indexable content. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 }];
}
