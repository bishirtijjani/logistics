import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Landmark,
  Layers,
  Lock,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata = {
  title: "Bank & payment partners",
  description:
    "Partner with iPrime as a bank or licensed payment provider — virtual accounts, wallet rails, settlements, and KYC for thousands of Katsina users.",
  alternates: { canonical: "/partners/banking" },
};

const opportunities = [
  {
    Icon: Wallet,
    title: "Virtual account issuance",
    body: "Issue a unique, dedicated NUBAN to every iPrime user at signup. We handle UI, support, and reconciliation; you provide the rail and the licence.",
  },
  {
    Icon: Banknote,
    title: "Bank transfers & withdrawals",
    body: "Power the in-app bank transfer feature — customers move money to any Nigerian bank, instantly, through your NIP/NIBSS rail.",
  },
  {
    Icon: CreditCard,
    title: "Card acquiring & funding",
    body: "Process card top-ups from Verve, Visa, and Mastercard into the iPrime wallet. We pass the cost down transparently and split the fee with you.",
  },
  {
    Icon: ShieldCheck,
    title: "BVN, NIN & document KYC",
    body: "Help us KYC every new user before they hold a wallet balance — BVN match, NIN match, and document verification on rider sign-ups.",
  },
];

const reasonsToPartner = [
  {
    Icon: Layers,
    title: "Embedded distribution into a daily-use super-app.",
    body: "iPrime isn't a once-a-month bill-pay app. Customers open it to order food, send packages, top up airtime, and pay electricity — your rail powers every one of those flows.",
  },
  {
    Icon: BarChart3,
    title: "Predictable, growing volume.",
    body: "Wallet top-ups, P2P transfers, and bill payments compound as cities go live. You'll see month-on-month transaction growth tied directly to our launch calendar.",
  },
  {
    Icon: Lock,
    title: "Reconciliation done right.",
    body: "Every transaction in the iPrime wallet is double-entry ledgered and reconciled daily against your settlement reports. Disputes are rare; investigations are fast.",
  },
  {
    Icon: FileCheck2,
    title: "A compliance partner, not just a customer.",
    body: "We treat NDPA, CBN PSD Sandbox guidance, and AML rules as platform commitments — not checkbox items. Our compliance posture protects your licence as much as ours.",
  },
];

const requirements = [
  "CBN licence (commercial bank, MFB, PSSP, PSP, or switching as relevant to scope).",
  "NIBSS membership for instant transfer rails — direct or via approved aggregator.",
  "Production-grade API with sandbox access, webhooks, and SLA-backed uptime.",
  "Data-processing agreement compatible with the Nigeria Data Protection Act 2023.",
  "AML/KYC posture you're willing to defend on an annual review.",
];

const stats = [
  { label: "Wallet posture", value: "Double-entry ledger, daily reconciliation" },
  { label: "KYC tiers", value: "BVN + NIN, escalated for riders" },
  { label: "Data residency", value: "All PII stored in Nigeria, NDPA-compliant" },
  { label: "Failure refunds", value: "Automated, no manual support ticket" },
];

export default function BankingPartnersPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative pt-36 pb-16 md:pt-40 md:pb-20 bg-bg-secondary">
          <div className="ui-container">
            <div className="max-w-3xl">
              <span className="ui-eyebrow">For bank &amp; payment partners</span>
              <h1 className="text-4xl md:text-5xl xl:text-[3.5rem] font-black tracking-tighter leading-[1.05] text-text-primary mb-6">
                The wallet rail behind{" "}
                <span className="text-accent">a state-wide super-app.</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 font-medium leading-relaxed max-w-2xl mb-8">
                iPrime is built on top of licensed Nigerian financial-service
                providers. If you&apos;re a bank, microfinance bank, PSP, or
                switching company looking for embedded distribution in
                northern Nigeria — let&apos;s talk.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="mailto:partnerships@vtulogistics.com?subject=Banking%20partnership%20%E2%80%94%20%5BInstitution%5D"
                  className="ui-btn ui-btn-primary"
                >
                  Email partnerships
                  <ArrowRight size={16} strokeWidth={2.5} />
                </a>
                <a href="#requirements" className="ui-btn ui-btn-ghost">
                  What we look for
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="ui-section bg-white">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">Where we partner</span>
              <h2 className="ui-title">
                Four rails{" "}
                <span className="text-accent">we actively need.</span>
              </h2>
              <p className="ui-sub">
                These are the integration surfaces where a banking partner
                directly shapes the customer experience.
              </p>
            </header>

            <div className="grid md:grid-cols-2 gap-5">
              {opportunities.map((o) => (
                <article
                  key={o.title}
                  className="ui-card hover:border-accent/40 hover:shadow-lg transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center mb-4 shadow-md">
                    <o.Icon size={20} strokeWidth={2.25} />
                  </div>
                  <h3 className="text-lg md:text-xl font-extrabold tracking-tight text-text-primary mb-2">
                    {o.title}
                  </h3>
                  <p className="text-gray-500 font-medium leading-relaxed">
                    {o.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section bg-bg-secondary">
          <div className="ui-container">
            <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
              <div>
                <span className="ui-eyebrow">Why partner with iPrime</span>
                <h2 className="ui-title mb-6">
                  Built like a financial product,{" "}
                  <span className="text-accent">not a side feature.</span>
                </h2>
                <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-8">
                  We approach wallet and payment services with the same rigor
                  a licensed institution would. Below is the posture we
                  bring to every integration — and the standard we hold our
                  side of the rail to.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {stats.map((s) => (
                    <div
                      key={s.label}
                      className="bg-white border border-gray-200 rounded-2xl p-4"
                    >
                      <div className="text-[0.65rem] font-extrabold uppercase tracking-widest text-gray-400 mb-1">
                        {s.label}
                      </div>
                      <div className="text-sm font-extrabold tracking-tight text-text-primary leading-snug">
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                {reasonsToPartner.map((r) => (
                  <article
                    key={r.title}
                    className="bg-white border border-gray-200 rounded-2xl p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-accent-dim text-accent flex items-center justify-center shrink-0">
                        <r.Icon size={18} strokeWidth={2.25} />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold tracking-tight text-text-primary mb-1 leading-snug">
                          {r.title}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium leading-relaxed">
                          {r.body}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="ui-section bg-white" id="requirements">
          <div className="ui-container">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
              <div>
                <span className="ui-eyebrow">What we look for</span>
                <h2 className="ui-title mb-6">
                  Partner{" "}
                  <span className="text-accent">requirements.</span>
                </h2>
                <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-6">
                  We&apos;re happy to talk to institutions of any size, but
                  the integration surfaces above require the licences and
                  controls below. If you&apos;re missing one, we can route
                  through an aggregator you trust.
                </p>
                <Link
                  href="/legal/compliance"
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-text-primary hover:text-accent transition-colors no-underline"
                >
                  See our compliance posture
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>

              <div className="bg-bg-secondary border border-gray-200 rounded-3xl p-7 md:p-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-text-primary text-white flex items-center justify-center">
                    <Landmark size={18} strokeWidth={2.25} />
                  </div>
                  <div className="text-base font-extrabold tracking-tight text-text-primary">
                    Minimum requirements
                  </div>
                </div>
                <ul className="space-y-4 list-none p-0">
                  {requirements.map((r) => (
                    <li key={r} className="flex items-start gap-3">
                      <CheckCircle2
                        size={20}
                        strokeWidth={2.5}
                        className="text-accent shrink-0 mt-0.5"
                      />
                      <span className="text-base text-text-primary font-semibold leading-relaxed">
                        {r}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
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
                  Let&apos;s talk
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-[1.05] mb-5">
                  Reach out with one paragraph.{" "}
                  <span className="text-accent">We&apos;ll take it from there.</span>
                </h2>
                <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed mb-8">
                  Tell us your institution, the rail you want to bring, and
                  who on your side will own the integration. We&apos;ll come
                  back with our compliance pack, technical contact, and a
                  proposed timeline within three business days.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="mailto:partnerships@vtulogistics.com?subject=Banking%20partnership%20%E2%80%94%20%5BInstitution%5D"
                    className="ui-btn ui-btn-primary"
                  >
                    partnerships@vtulogistics.com
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </a>
                  <Link
                    href="/partners/bill-payment"
                    className="ui-btn ui-btn-ghost"
                  >
                    Bill payment partners
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
