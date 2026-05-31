import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadIndex, loadGuideBody, loadManifest, stripLeadingH1 } from "../../helpData";
import HelpSidebar from "../../HelpSidebar";

export const dynamicParams = false;

export async function generateStaticParams() {
  const { guides } = await loadIndex();
  return guides.map((g) => ({ role: g.role, slug: g.slug }));
}

export async function generateMetadata({ params }) {
  const { role, slug } = await params;
  const { guides } = await loadIndex();
  const g = guides.find((x) => x.role === role && x.slug === slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.summary,
    alternates: { canonical: `/help/${role}/${slug}` },
  };
}

export default async function GuidePage({ params }) {
  const { role, slug } = await params;
  const { roles, categories, guides } = await loadIndex();
  const guide = guides.find((x) => x.role === role && x.slug === slug);
  const manifest = await loadManifest();
  const meta = manifest.guides.find((x) => x.role === role && x.slug === slug);
  if (!guide || !meta) notFound();

  const body = stripLeadingH1((await loadGuideBody(meta.file)) || "");

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="ui-container flex items-center justify-between h-16">
          <Link href="/help" className="font-black text-lg tracking-tight no-underline text-text-primary">
            iPrime <span className="text-accent">Help</span>
          </Link>
          <Link href="/help" className="text-sm font-semibold text-accent no-underline hover:underline">
            ← All guides
          </Link>
        </div>
      </header>

      <div className="ui-container py-10 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-10">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <HelpSidebar roles={roles} categories={categories} guides={guides} current={`${role}/${slug}`} />
        </aside>

        {/* Article */}
        <article className="legal-prose help-prose max-w-3xl">
          <p className="ui-eyebrow !mb-2">{role}</p>
          <h1>{guide.title}</h1>
          <p className="lead">{guide.summary}</p>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>

          <footer className="mt-16 border-t border-gray-200 pt-6 text-sm text-gray-500">
            Was this helpful? Reach us anytime from{" "}
            <strong>Support</strong> in your dashboard, or email{" "}
            <a className="text-accent hover:underline" href="mailto:support@iprime.ng">
              support@iprime.ng
            </a>
            .
          </footer>
        </article>
      </div>
    </main>
  );
}
