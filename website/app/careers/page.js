import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Code,
  Heart,
  MapPin,
  Send,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "Careers",
  description:
    "Help build Katsina's delivery and wallet super-app. Engineering, operations, rider success, and merchant growth roles - apply by email.",
  alternates: { canonical: "/careers" },
};

const values = [
  {
    Icon: Heart,
    title: "Customers, riders, merchants - in that order.",
    body: "Every product decision starts with one of those three. We ship what helps them, and we cut what doesn't.",
  },
  {
    Icon: Sparkles,
    title: "Small team, real ownership.",
    body: "You'll own a surface end-to-end and ship to real users in days, not quarters. No middle layer between you and impact.",
  },
  {
    Icon: MapPin,
    title: "Built in Katsina, not parachuted in.",
    body: "We're locals solving a local problem. The streets, the markets, the way people pay - that's the context the work is grounded in.",
  },
  {
    Icon: Wallet,
    title: "Sustainable, not sprint-and-burn.",
    body: "We work hard, but we don't romanticise hustle. We pay fairly, take days off, and build for the long run.",
  },
];

const tracks = [
  {
    Icon: Code,
    eyebrow: "Engineering",
    title: "Mobile, backend, web - full-stack.",
    blurb:
      "React Native (Expo), Node.js, MongoDB, Redis. We want engineers who care about reliability on a 3G phone in Funtua just as much as on fibre in Lagos.",
  },
  {
    Icon: Truck,
    eyebrow: "Operations",
    title: "Rider success & city launches.",
    blurb:
      "Onboard new riders, train them, keep retention high. Open new towns across the state. Field work, not desk work.",
  },
  {
    Icon: Users,
    eyebrow: "Growth",
    title: "Merchant sales & partnerships.",
    blurb:
      "Sign up restaurants, pharmacies, supermarkets. Negotiate listings, support them through the first 100 orders, and grow their basket.",
  },
];

export default function CareersPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative pt-36 pb-16 md:pt-40 md:pb-20 bg-bg-secondary">
          <div className="ui-container">
            <div className="max-w-3xl">
              <span className="ui-eyebrow">Careers at Logistics Platform</span>
              <h1 className="text-4xl md:text-5xl xl:text-[3.5rem] font-black tracking-tighter leading-[1.05] text-text-primary mb-6">
                Build Katsina&apos;s next big company.{" "}
                <span className="text-accent">From Katsina.</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 font-medium leading-relaxed max-w-2xl">
                We&apos;re a small team building the wallet, delivery, and bill
                payment app that thousands of households across 
                use every week. If you want real ownership, fast shipping, and
                work that visibly changes how your neighbours live - read on.
              </p>
            </div>
          </div>
        </section>

        <section className="ui-section bg-white">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">What we believe</span>
              <h2 className="ui-title">
                How we work,{" "}
                <span className="text-accent">in four lines.</span>
              </h2>
            </header>

            <div className="grid md:grid-cols-2 gap-5">
              {values.map((v) => (
                <article
                  key={v.title}
                  className="ui-card hover:border-accent/40 hover:shadow-lg transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-accent-dim text-accent flex items-center justify-center mb-4">
                    <v.Icon size={20} strokeWidth={2.25} />
                  </div>
                  <h3 className="text-lg md:text-xl font-extrabold tracking-tight text-text-primary mb-2">
                    {v.title}
                  </h3>
                  <p className="text-gray-500 font-medium leading-relaxed">
                    {v.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section bg-bg-secondary">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">Where we hire</span>
              <h2 className="ui-title">
                The three tracks{" "}
                <span className="text-accent">we&apos;re building.</span>
              </h2>
              <p className="ui-sub">
                We don&apos;t always have an open job posting for every role -
                but if you fit one of these tracks and want to work on Logistics Platform,
                we want to hear from you.
              </p>
            </header>

            <div className="grid md:grid-cols-3 gap-5">
              {tracks.map((t) => (
                <article
                  key={t.eyebrow}
                  className="bg-white border border-gray-200 rounded-3xl p-7 hover:border-accent/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-text-primary text-white flex items-center justify-center mb-5">
                    <t.Icon size={20} strokeWidth={2.25} />
                  </div>
                  <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-accent mb-2">
                    {t.eyebrow}
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight text-text-primary mb-3 leading-tight">
                    {t.title}
                  </h3>
                  <p className="text-gray-500 font-medium leading-relaxed">
                    {t.blurb}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section bg-white">
          <div className="ui-container">
            <div className="bg-text-primary text-white rounded-3xl p-8 md:p-12 lg:p-16 relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent/20 blur-3xl"
              />
              <div className="relative max-w-2xl">
                <span className="text-[0.7rem] font-extrabold uppercase tracking-widest text-accent mb-3 block">
                  Open applications
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-[1.05] mb-5">
                  No formal openings right now -{" "}
                  <span className="text-accent">but we&apos;re still reading.</span>
                </h2>
                <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed mb-8">
                  Tell us which track fits you, what you&apos;d want to own, and
                  attach whatever proves you can do it (CV, GitHub, a recorded
                  walkthrough, a list of merchants you&apos;ve already signed
                  somewhere else - whichever is most honest). One human
                  reads every application.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="mailto:careers@?subject=Logistics Platform%20Careers%20%E2%80%94%20application"
                    className="ui-btn ui-btn-primary"
                  >
                    Email careers@
                    <Send size={16} strokeWidth={2.5} />
                  </a>
                  <Link href="/#contact" className="ui-btn ui-btn-ghost">
                    Or use the contact form
                    <ArrowUpRight size={16} strokeWidth={2.5} />
                  </Link>
                </div>

                <p className="text-xs text-white/40 font-semibold mt-6">
                  Riders: don&apos;t use this email - apply directly inside the
                  Logistics Platform Rider app, or via the{" "}
                  <Link href="/#contact" className="underline hover:text-white">
                    contact form
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="ui-section bg-bg-secondary">
          <div className="ui-container">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-t border-gray-200 pt-10">
              <div>
                <div className="text-sm font-extrabold uppercase tracking-widest text-gray-400 mb-1">
                  Looking for press?
                </div>
                <div className="text-lg font-extrabold tracking-tight text-text-primary">
                  Find our facts, logos, and contact in one place.
                </div>
              </div>
              <Link
                href="/press"
                className="inline-flex items-center gap-2 text-sm font-extrabold text-text-primary hover:text-accent transition-colors no-underline"
              >
                Press kit
                <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
