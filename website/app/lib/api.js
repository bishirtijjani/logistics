/**
 * Resolves the iPrime backend base URL for the statically exported website.
 *
 * The export is built ahead of time (`next build`), so the URL is baked in
 * at build time via NEXT_PUBLIC_API_URL. Fallback hits the production
 * backend so a forgotten env var doesn't silently 404 forms in production.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "https://api.iprime.ng";
