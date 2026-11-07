import Link from "next/link";
import { loadIndex } from "./helpData";
import HelpBrowser from "./HelpBrowser";

export const metadata = {
  title: "Help Center",
  description:
    "Step-by-step guides for using Logistics Platform - set up your shop, manage orders, get paid, and more.",
  alternates: { canonical: "/help" },
};

export default async function HelpHome() {
  const { roles, categories, guides } = await loadIndex();

  return (
    <main className="min-h-screen bg-bg-secondary" style={{ background: "var(--color-bg-secondary)" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="ui-container flex items-center justify-between h-16">
          <Link href="/" className="font-black text-lg tracking-tight no-underline text-text-primary">
            Logistics Platform <span className="text-accent">Help</span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-accent no-underline hover:underline">
            ← Back to Logistics Platform
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="ui-container pt-12 pb-2 text-center">
        <span className="ui-eyebrow">Help Center</span>
        <h1 className="ui-title">How can we help?</h1>
        <p className="ui-sub mx-auto">
          Friendly, step-by-step guides for getting the most out of Logistics Platform.
        </p>
      </section>

      {/* Search + browse */}
      <section className="ui-container max-w-5xl pt-10 pb-24">
        <HelpBrowser roles={roles} categories={categories} guides={guides} />
      </section>
    </main>
  );
}
