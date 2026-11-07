import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Download as DownloadIcon,
  Mail,
  MapPin,
  Smartphone,
  Truck,
  Wallet,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "Press & Media",
  description:
    "Press kit for Logistics Platform - Katsina's delivery, wallet, and bill payment app. Boilerplate, brand assets, fast facts, and a direct media contact.",
  alternates: { canonical: "/press" },
};

const facts = [
  { Icon: MapPin, label: "Headquarters", value: "Katsina, Nigeria" },
  { Icon: Calendar, label: "Founded", value: "2025" },
  { Icon: Truck, label: "Service area", value: "" },
  { Icon: Wallet, label: "Core products", value: "Delivery · Wallet · Bills" },
  { Icon: Smartphone, label: "Apps", value: "Customer · Rider · Merchant" },
  { Icon: Mail, label: "Press contact", value: "press@" },
];

const oneLiners = [
  {
    label: "Twitter bio (160 chars)",
    text: "Logistics Platform - order anything, track it live, and pay every bill from one wallet. Built in Katsina, for Katsina.",
  },
  {
    label: "Short boilerplate (40 words)",
    text: "Logistics Platform is Katsina's home-grown delivery and wallet super-app. Customers order food, groceries, pharmacy, and parcels with live rider tracking - and pay airtime, data, and electricity bills from the same balance.",
  },
  {
    label: "Long boilerplate (90 words)",
    text: "Logistics Platform is a logistics and payments platform serving . The customer app connects households to local restaurants, supermarkets, pharmacies, and independent riders for door-to-door delivery, while a built-in wallet handles airtime top-ups, data bundles, electricity bill payments, and TV subscriptions. Independent riders earn through the Logistics Platform Rider app, and local businesses sell through the Logistics Platform Merchant tools. The company is headquartered in Katsina and operates under Nigerian Data Protection Act 2023 and Central Bank of Nigeria regulations for wallet services.",
  },
];

const assets = [
  {
    title: "Logo - primary (PNG)",
    desc: "Burnt-orange Logistics Platform mark on transparent background.",
    href: "mailto:press@?subject=Press%20kit%20%E2%80%94%20logo%20request",
  },
  {
    title: "Logo - monochrome (SVG)",
    desc: "Single-colour SVG for print and dark backgrounds.",
    href: "mailto:press@?subject=Press%20kit%20%E2%80%94%20logo%20request",
  },
  {
    title: "App screenshots",
    desc: "Customer, rider, and merchant app shots at 3x retina.",
    href: "mailto:press@?subject=Press%20kit%20%E2%80%94%20screenshots",
  },
  {
    title: "Founder headshots",
    desc: "High-res portraits for editorial use.",
    href: "mailto:press@?subject=Press%20kit%20%E2%80%94%20headshots",
  },
];

export default function PressPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative pt-36 pb-16 md:pt-40 md:pb-20 bg-bg-secondary">
          <div className="ui-container">
            <div className="max-w-3xl">
              <span className="ui-eyebrow">Press &amp; media</span>
              <h1 className="text-4xl md:text-5xl xl:text-[3.5rem] font-black tracking-tighter leading-[1.05] text-text-primary mb-6">
                Everything a journalist or partner{" "}
                <span className="text-accent">needs in one place.</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 font-medium leading-relaxed max-w-2xl mb-8">
                Boilerplate, fast facts, logos and screenshots, and a direct
                line to a human. Writing a story about northern Nigerian tech,
                cashless wallets, or the last-mile delivery space?
                We&apos;re happy to talk.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="mailto:press@?subject=Press%20enquiry"
                  className="ui-btn ui-btn-primary"
                >
                  Email press@
                  <ArrowRight size={16} strokeWidth={2.5} />
                </a>
                <a href="#assets" className="ui-btn ui-btn-ghost">
                  Brand assets
                  <DownloadIcon size={16} strokeWidth={2.5} />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="ui-section bg-white">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">Fast facts</span>
              <h2 className="ui-title">
                The basics, <span className="text-accent">at a glance.</span>
              </h2>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {facts.map((f) => (
                <div
                  key={f.label}
                  className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-accent-dim text-accent flex items-center justify-center shrink-0">
                    <f.Icon size={18} strokeWidth={2.25} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-widest text-gray-400 mb-0.5">
                      {f.label}
                    </div>
                    <div className="text-base font-extrabold tracking-tight text-text-primary">
                      {f.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section bg-bg-secondary">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">Boilerplate</span>
              <h2 className="ui-title">
                Ready-to-paste{" "}
                <span className="text-accent">company copy.</span>
              </h2>
              <p className="ui-sub">
                Use whichever fits your word count. Cite as &quot;Logistics Platform&quot;
                on first reference; &quot;the company&quot; thereafter.
              </p>
            </header>

            <div className="space-y-4">
              {oneLiners.map((o) => (
                <article
                  key={o.label}
                  className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8"
                >
                  <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-accent mb-3">
                    {o.label}
                  </div>
                  <p className="text-base md:text-lg text-text-primary font-medium leading-relaxed">
                    {o.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section bg-white" id="assets">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">Brand assets</span>
              <h2 className="ui-title">
                Logos, screenshots,{" "}
                <span className="text-accent">and portraits.</span>
              </h2>
              <p className="ui-sub">
                We&apos;ll send you the pack within one business day. We
                don&apos;t host these publicly so we can track which outlets
                are covering us.
              </p>
            </header>

            <div className="grid md:grid-cols-2 gap-4">
              {assets.map((a) => (
                <a
                  key={a.title}
                  href={a.href}
                  className="group flex items-start justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-6 hover:border-accent/40 hover:shadow-lg transition-all no-underline"
                >
                  <div>
                    <div className="text-base font-extrabold tracking-tight text-text-primary mb-1 group-hover:text-accent transition-colors">
                      {a.title}
                    </div>
                    <div className="text-sm text-gray-500 font-medium">
                      {a.desc}
                    </div>
                  </div>
                  <ArrowUpRight
                    size={20}
                    strokeWidth={2.5}
                    className="text-gray-300 group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section bg-bg-secondary">
          <div className="ui-container">
            <div className="bg-text-primary text-white rounded-3xl p-8 md:p-12 lg:p-16 relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent/20 blur-3xl"
              />
              <div className="relative max-w-2xl">
                <span className="text-[0.7rem] font-extrabold uppercase tracking-widest text-accent mb-3 block">
                  Media contact
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-[1.05] mb-5">
                  Got a deadline?{" "}
                  <span className="text-accent">We respond fast.</span>
                </h2>
                <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed mb-8">
                  We aim to reply to journalists within 24 hours on weekdays.
                  Mention your outlet, your angle, and your filing deadline in
                  the first line and we&apos;ll prioritise accordingly.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="mailto:press@?subject=Press%20enquiry%20%E2%80%94%20%5BOutlet%5D"
                    className="ui-btn ui-btn-primary"
                  >
                    press@
                    <Mail size={16} strokeWidth={2.5} />
                  </a>
                  <Link href="/#contact" className="ui-btn ui-btn-ghost">
                    Contact form
                    <ArrowUpRight size={16} strokeWidth={2.5} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
