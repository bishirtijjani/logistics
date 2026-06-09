import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Map URL slug → on-disk markdown source. The markdown files live in the
// repo's /docs/legal/ tree so they stay in version control alongside the
// rest of the platform; this route reads them at build time and renders
// them as static pages.
const SLUGS = {
  privacy: {
    file: "privacy-policy.md",
    title: "Privacy Policy",
    description:
      "How iPrime collects, uses, stores, and shares your personal data - written for the Nigeria Data Protection Act.",
  },
  terms: {
    file: "terms-of-service.md",
    title: "Terms of Service",
    description:
      "The agreement that governs your use of iPrime - wallet, deliveries, and the platform overall.",
  },
  refund: {
    file: "refund-policy.md",
    title: "Refund Policy",
    description:
      "When and how iPrime refunds money - bill payments, wallet operations, delivery orders, and cancellations.",
  },
  compliance: {
    file: "compliance.md",
    title: "Compliance Statement",
    description:
      "How iPrime complies with the NDPA, CBN, FCCPA, and NIPOST rules that apply to a Nigerian wallet and delivery platform.",
  },
  "account-deletion": {
    file: "account-deletion.md",
    title: "Delete your account",
    description:
      "How to delete your iPrime account, and what data is removed or retained when you do.",
  },
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return Object.keys(SLUGS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const meta = SLUGS[slug];
  if (!meta) return {};
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/legal/${slug}` },
  };
}

async function loadMarkdown(slug) {
  const meta = SLUGS[slug];
  if (!meta) return null;
  // Resolve up from /website to the repo's /docs/legal/.
  const file = path.join(process.cwd(), "..", "docs", "legal", meta.file);
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

// Site is built with `output: 'export'` (see next.config.mjs), so this
// page must be fully static. {{TODAY}} resolves at build time - meaning
// the "Last updated" date refreshes on every deploy/webhook rebuild.
export default async function LegalPage({ params }) {
  const { slug } = await params;
  const meta = SLUGS[slug];
  const content = meta ? await loadMarkdown(slug) : null;
  if (!meta || !content) notFound();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });
  const rendered = content.replace(/\{\{TODAY\}\}/g, today);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <Link
          href="/"
          className="inline-block text-sm font-semibold text-orange-700 hover:underline"
        >
          ← Back to iPrime
        </Link>

        <article className="legal-prose mt-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{rendered}</ReactMarkdown>
        </article>

        <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
          <p>
            Questions about this document? Email{" "}
            <a className="text-orange-700 hover:underline" href="mailto:bishirtijjani247@gmail.com">
              bishirtijjani247@gmail.com
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
