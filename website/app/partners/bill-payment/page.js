import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Lightbulb,
  Network,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Tv,
  Zap,
} from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata = {
  title: "Bill payment partners",
  description:
    "Partner with Logistics Platform to offer your airtime, data, electricity, or TV bill product to thousands of Katsina households through the Logistics Platform wallet.",
  alternates: { canonical: "/partners/bill-payment" },
};

const verticals = [
  {
    Icon: Smartphone,
    title: "Telcos - airtime & data",
    body: "MTN, Glo, Airtel, 9mobile. We surface your bundles inside the customer app with live availability and instant wallet debit.",
  },
  {
    Icon: Zap,
    title: "DISCOs - electricity tokens",
    body: "All 11 Nigerian discos. Prepaid tokens delivered to the customer within seconds, with automatic wallet refund on failure.",
  },
  {
    Icon: Tv,
    title: "TV - subscription top-ups",
    body: "DStv, GOtv, Startimes, Showmax. One-tap renewals from the wallet, with smartcard validation before debit.",
  },
  {
    Icon: ReceiptText,
    title: "Education & other recurring bills",
    body: "WAEC, NECA result-checker PINs, JAMB, exam fees - and any new biller you launch. Tell us your spec, we&apos;ll plug it in.",
  },
];

const benefits = [
  {
    Icon: Network,
    title: "A new distribution channel - no field sales required.",
    body: "Customers already in the Logistics Platform wallet see your product the moment they tap their utility tile. No leaflets, no agent networks, no onboarding costs from your side.",
  },
  {
    Icon: BadgeCheck,
    title: "Verified, KYC-cleared customers.",
    body: "Every Logistics Platform user is BVN-verified before they can hold a wallet balance. The transactions you process for us are from real, traceable Nigerian residents - not throwaway accounts.",
  },
  {
    Icon: ShieldCheck,
    title: "Automated reconciliation & refunds.",
    body: "We monitor every vend in real time. Failed top-ups trigger an instant wallet refund to the customer, so your support queue stays empty and we keep the dispute liability on our side.",
  },
  {
    Icon: Lightbulb,
    title: "Co-marketed launches in northern Nigeria.",
    body: "When you add a new bundle or product, we co-promote it across the app, push notifications, and our radio/billboard slots in Katsina. Real reach into a market most national billers underserve.",
  },
];

const integrationPoints = [
  "REST API or aggregator pass-through - whichever your stack already supports.",
  "Webhook-based transaction status updates (or polling, if you must).",
  "Test/sandbox keys before we go live, with full UAT against your billing system.",
  "Settlement to your bank account on the cycle you define (T+0 / T+1 / weekly).",
  "Compliance docs: NDPA data-sharing addendum, CBN-aligned reconciliation policy, signed NDA on request.",
];

export default function BillPaymentPartnersPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative pt-36 pb-16 md:pt-40 md:pb-20 bg-bg-secondary">
          <div className="ui-container">
            <div className="max-w-3xl">
              <span className="ui-eyebrow">For bill payment partners</span>
              <h1 className="text-4xl md:text-5xl xl:text-[3.5rem] font-black tracking-tighter leading-[1.05] text-text-primary mb-6">
                Reach Katsina households{" "}
                <span className="text-accent">from inside their wallet.</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 font-medium leading-relaxed max-w-2xl mb-8">
                We integrate telcos, electricity discos, TV providers and
                recurring-bill issuers directly into the Logistics Platform wallet. If
                you have a product Nigerian households pay for monthly, we
                want to surface it to ours.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="mailto:partnerships@?subject=Bill%20payment%20partnership%20%E2%80%94%20%5BCompany%5D"
                  className="ui-btn ui-btn-primary"
                >
                  Email the partnerships team
                  <ArrowRight size={16} strokeWidth={2.5} />
                </a>
                <a href="#integration" className="ui-btn ui-btn-ghost">
                  How integration works
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="ui-section bg-white">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">What we plug in</span>
              <h2 className="ui-title">
                The bills{" "}
                <span className="text-accent">our customers already pay.</span>
              </h2>
              <p className="ui-sub">
                These are the categories live today inside the customer app.
                If your product fits somewhere adjacent, we&apos;ll figure out
                where it slots in.
              </p>
            </header>

            <div className="grid md:grid-cols-2 gap-5">
              {verticals.map((v) => (
                <article
                  key={v.title}
                  className="ui-card hover:border-accent/40 hover:shadow-lg transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center mb-4 shadow-md">
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
              <span className="ui-eyebrow">Why partner with Logistics Platform</span>
              <h2 className="ui-title">
                What you get,{" "}
                <span className="text-accent">in concrete terms.</span>
              </h2>
            </header>

            <div className="grid md:grid-cols-2 gap-5">
              {benefits.map((b) => (
                <article
                  key={b.title}
                  className="bg-white border border-gray-200 rounded-3xl p-7 hover:border-accent/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-text-primary text-white flex items-center justify-center mb-5">
                    <b.Icon size={20} strokeWidth={2.25} />
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight text-text-primary mb-3 leading-tight">
                    {b.title}
                  </h3>
                  <p className="text-gray-500 font-medium leading-relaxed">
                    {b.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section bg-white" id="integration">
          <div className="ui-container">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
              <div>
                <span className="ui-eyebrow">Integration</span>
                <h2 className="ui-title mb-6">
                  Standard stack,{" "}
                  <span className="text-accent">flexible terms.</span>
                </h2>
                <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-6">
                  We&apos;ve already integrated multiple billers and
                  payment partners. The pattern is the same every time -
                  we&apos;ll send our integration spec the day you reply, and
                  expect to be in UAT within a fortnight on most stacks.
                </p>
                <Link
                  href="/#contact"
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-text-primary hover:text-accent transition-colors no-underline"
                >
                  Get the integration pack
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>

              <div className="bg-bg-secondary border border-gray-200 rounded-3xl p-7 md:p-10">
                <ul className="space-y-4 list-none p-0">
                  {integrationPoints.map((p) => (
                    <li key={p} className="flex items-start gap-3">
                      <CheckCircle2
                        size={20}
                        strokeWidth={2.5}
                        className="text-accent shrink-0 mt-0.5"
                      />
                      <span className="text-base text-text-primary font-semibold leading-relaxed">
                        {p}
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
                  Next step
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-[1.05] mb-5">
                  Tell us what you sell.{" "}
                  <span className="text-accent">We&apos;ll send a spec.</span>
                </h2>
                <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed mb-8">
                  One email is enough to start: who you are, which product,
                  the volume you process today, and any integration
                  preferences. We&apos;ll come back with our spec sheet and a
                  proposed commercial structure within two business days.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="mailto:partnerships@?subject=Bill%20payment%20partnership%20%E2%80%94%20%5BCompany%5D"
                    className="ui-btn ui-btn-primary"
                  >
                    partnerships@
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </a>
                  <Link href="/partners/banking" className="ui-btn ui-btn-ghost">
                    Banking partners
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
