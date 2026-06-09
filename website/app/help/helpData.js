// Server-only helpers that load the Help Center content at build time.
// The markdown bodies + manifest live in the repo's /docs/help tree (shared,
// version-controlled), mirroring how /legal/[slug] reads /docs/legal.
import fs from "node:fs/promises";
import path from "node:path";

const HELP_DIR = path.join(process.cwd(), "..", "docs", "help");

export async function loadManifest() {
  const raw = await fs.readFile(path.join(HELP_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw);
}

export async function loadGuideBody(file) {
  try {
    return await fs.readFile(path.join(HELP_DIR, file), "utf8");
  } catch {
    return null;
  }
}

// Strip a leading "# Title" line so the page can render the title itself
// (from the manifest) without it appearing twice.
export function stripLeadingH1(body) {
  return body.replace(/^\s*#\s+.*\r?\n+/, "");
}

// Reduce markdown to plain words for client-side search.
function toSearchText(body) {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/[#>*`_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Build the index passed to client components for browse + search.
export async function loadIndex() {
  const manifest = await loadManifest();
  // The public web Help Center only publishes guides for "public" roles
  // (merchants). Internal/admin docs are excluded here - they remain available
  // only inside the authenticated admin dashboard's in-app help panel.
  const roles = (manifest.roles || []).filter((r) => r.public !== false);
  const publicRoleIds = new Set(roles.map((r) => r.id));
  const guides = [];
  for (const g of manifest.guides) {
    if (!publicRoleIds.has(g.role)) continue;
    const body = (await loadGuideBody(g.file)) || "";
    guides.push({
      role: g.role,
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      category: g.category,
      order: g.order ?? 999,
      keywords: g.keywords || [],
      text: toSearchText(body),
    });
  }
  return { roles, categories: manifest.categories || [], guides };
}
