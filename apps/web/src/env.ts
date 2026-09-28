import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables — never exposed to the browser.
   * Add new server vars here + to .env.local and .env.example.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    AUTH_SECRET: z.string().min(1),
    AUTH_AZURE_AD_CLIENT_ID: z.string().min(1),
    AUTH_AZURE_AD_CLIENT_SECRET: z.string().min(1),
    AUTH_AZURE_AD_TENANT_ID: z.string().min(1),
    AWS_S3_BUCKET: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).optional(),
  },

  /**
   * Client-side environment variables — must be prefixed with NEXT_PUBLIC_.
   * Add new client vars here + to .env.local and .env.example.
   */
  client: {
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_MAPBOX_TOKEN: z.string().startsWith("pk."),
    NEXT_PUBLIC_CAMPUS_MAP_TOKEN: z.string().startsWith("pk."),
    NEXT_PUBLIC_CAMPUS_MAP_STYLE: z.string().startsWith("mapbox://"),
    /** Public origin used for metadata/OG/sitemap. Defaults to https://forum.tigerapps.org. */
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  },

  /**
   * Explicit mapping from process.env — required for T3 env to validate at runtime.
   * Every key declared above must appear here.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_CAMPUS_MAP_TOKEN: process.env.NEXT_PUBLIC_CAMPUS_MAP_TOKEN,
    NEXT_PUBLIC_CAMPUS_MAP_STYLE: process.env.NEXT_PUBLIC_CAMPUS_MAP_STYLE,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_AZURE_AD_CLIENT_ID: process.env.AUTH_AZURE_AD_CLIENT_ID,
    AUTH_AZURE_AD_CLIENT_SECRET: process.env.AUTH_AZURE_AD_CLIENT_SECRET,
    AUTH_AZURE_AD_TENANT_ID: process.env.AUTH_AZURE_AD_TENANT_ID,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_REGION: process.env.AWS_REGION,
  },

  /**
   * Throw on missing env vars in production; warn in development.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
