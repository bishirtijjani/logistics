import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  FileText,
  Pill,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Truck,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "For merchants",
  description:
    "List your restaurant, supermarket, pharmacy, or retail shop on iPrime. Daily payouts, integrated riders, no fixed monthly fee — sign up from your phone.",
  alternates: { canonical: "/merchants" },
};

const verticals = [
  {
    Icon: ChefHat,
    title: "Restaurants & street food",
    body: "From buka kitchens to QSR chains. We surface your menu, photograph hero items, and route every order to a nearby iPrime rider for pickup.",
  },
  {
    Icon: ShoppingCart,
    title: "Supermarkets & grocery stores",
    body: "List your aisles, set per-item availability, accept basket orders with substitution preferences set by the customer. We pack the experience around your stock.",
  },
  {
    Icon: Pill,
    title: "Pharmacies",
    body: "Take prescription and OTC orders with built-in prescription upload. Our app checks for prescription validity before the order even reaches you.",
  },
  {
    Icon: ShoppingBag,
    title: "Retail & specialty shops",
    body: "Phone accessories, beauty supplies, household goods, perfume shops. If you can fit it on a motorcycle, we can deliver it.",
  },
];

const benefits = [
  {
    Icon: CalendarClock,
    title: "Daily payouts to your bank.",
    body: "Settlements run every business morning for the prior day's orders. No begging for payouts at the end of the month; no 30-day net terms.",
  },
  {
    Icon: BadgeDollarSign,
    title: "No fixed monthly fee.",
    body: "We earn only when you do — a percentage commission on the orders iPrime actually delivers. Slow week? You pay nothing.",
  },
  {
    Icon: Truck,
    title: "Riders included, no fleet to manage.",
    body: "Every accepted order is auto-routed to a vetted iPrime rider nearby. You don't hire drivers, manage helmets, or chase missing parcels — we handle that side end-to-end.",
  },
  {
    Icon: TrendingUp,
    title: "We market with you.",
    body: "Featured-merchant slots, push-notification campaigns, and category banners — built into our app and our launch calendar. We grow your basket, not just our app.",
  },
];

const steps = [
  {
    n: "01",
    title: "Apply in five minutes.",
    body: "Tell us about your business and upload your registration documents. We aim to come back within two business days.",
  },
  {
    n: "02",
    title: "Build your listing together.",
    body: "Our merchant team helps you upload your menu / catalog, photograph hero items, and set your operating hours. Most new merchants go live in under a week.",
  },
  {
    n: "03",
    title: "Accept your first orders.",
    body: "Orders come into the iPrime Merchant app. You confirm, prepare, hand off to the assigned rider, and the customer gets a live track to their door.",
  },
  {
    n: "04",
    title: "Get paid next morning.",
    body: "End-of-day settlement automatically lands in your registered bank account by mid-morning the next business day, with a full transaction history in the app.",
  },
];

const requirements = [
  "Your business is registered with CAC (RC or BN) — or you have a clear plan to be within 30 days.",
  "A bank account in the business's name (or the proprietor's, for a BN).",
  "Where applicable: NAFDAC registration for pharmacy and packaged food categories; valid pharmacist licence for prescription dispensing.",
  "A smartphone (Android 9+ / iOS 14+) running the iPrime Merchant app.",
  "Willingness to keep menu / availability honest in real time — accurate stock is the #1 driver of repeat customers.",
];

export default function MerchantsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative min-h-[100svh] flex items-end pt-32 pb-16 md:pb-20 overflow-hidden">
          <Image
            src="/images/audience-merchant.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover -z-10"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/20 -z-10"
          />

          <div className="ui-container relative">
            <div className="max-w-3xl text-white">
              <span className="ui-eyebrow">For merchants</span>
              <h1 className="text-4xl md:text-5xl xl:text-[3.5rem] font-black tracking-tighter leading-[1.05] mb-6 text-white">
                Sell to Katsina,{" "}
                <span className="text-accent">straight from your phone.</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 font-medium leading-relaxed max-w-2xl mb-8">
                Plug your restaurant, supermarket, pharmacy, or retail shop
                into the iPrime customer base. We handle delivery, payment,
                and customer support — you focus on what you make.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://merchant.iprime.ng/register"
                  className="ui-btn ui-btn-primary"
                >
                  Register your business
                  <ArrowRight size={16} strokeWidth={2.5} />
                </a>
                <a
                  href="#how-it-works"
                  className="ui-btn ui-btn-ghost !bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
                >
                  See how it works
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="ui-section bg-white">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">Who we list</span>
              <h2 className="ui-title">
                Four categories,{" "}
                <span className="text-accent">live across the app.</span>
              </h2>
              <p className="ui-sub">
                If you fit one of these — or something close — we want you on
                the platform. We don&apos;t list age-restricted goods (alcohol,
                tobacco, unprescribed pharmaceuticals).
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
              <span className="ui-eyebrow">Why merchants choose iPrime</span>
              <h2 className="ui-title">
                Four reasons,{" "}
                <span className="text-accent">in plain terms.</span>
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

        <section className="ui-section bg-white" id="how-it-works">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">How it works</span>
              <h2 className="ui-title">
                From application{" "}
                <span className="text-accent">to first payout.</span>
              </h2>
              <p className="ui-sub">
                We aim to take most new merchants from application to live
                listing in under one business week.
              </p>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {steps.map((s) => (
                <article
                  key={s.n}
                  className="bg-white border border-gray-200 rounded-2xl p-6"
                >
                  <div className="text-[0.7rem] font-mono font-extrabold text-accent mb-3">
                    {s.n}
                  </div>
                  <h3 className="text-base font-extrabold tracking-tight text-text-primary mb-2">
                    {s.title}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">
                    {s.body}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-10">
              <Link href="/help/merchant/set-up-your-shop" className="ui-btn ui-btn-ghost">
                Read the step-by-step merchant guide
                <ArrowUpRight size={16} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>

        <section className="ui-section bg-bg-secondary">
          <div className="ui-container">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
              <div>
                <span className="ui-eyebrow">What we need from you</span>
                <h2 className="ui-title mb-6">
                  The basics{" "}
                  <span className="text-accent">to get you live.</span>
                </h2>
                <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-6">
                  Most merchants already have everything below. If you&apos;re
                  missing a doc or two, our team can guide you through the
                  CAC or NAFDAC process while we get the rest of your listing
                  ready.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500 font-semibold">
                  <Smartphone size={16} strokeWidth={2.5} className="text-accent" />
                  Merchant app available on iOS and Android.
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-7 md:p-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-accent-dim text-accent flex items-center justify-center">
                    <FileText size={18} strokeWidth={2.25} />
                  </div>
                  <div className="text-base font-extrabold tracking-tight text-text-primary">
                    Onboarding checklist
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

        <section className="ui-section bg-white">
          <div className="ui-container">
            <div className="bg-text-primary text-white rounded-3xl p-8 md:p-12 lg:p-16 relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent/20 blur-3xl"
              />
              <div className="relative max-w-2xl">
                <span className="text-[0.7rem] font-extrabold uppercase tracking-widest text-accent mb-3 block">
                  Apply
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-[1.05] mb-5">
                  Ready to go live?{" "}
                  <span className="text-accent">One email starts it.</span>
                </h2>
                <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed mb-8">
                  Send us your business name, category, location, and a number
                  to reach you on. We&apos;ll come back within two business
                  days with the onboarding pack and your assigned merchant
                  success contact.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="https://merchant.iprime.ng/register"
                    className="ui-btn ui-btn-primary"
                  >
                    Register your business
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </a>
                  <Link href="/riders" className="ui-btn ui-btn-ghost">
                    Apply as a rider instead
                    <ArrowUpRight size={16} strokeWidth={2.5} />
                  </Link>
                </div>
                <p className="mt-6 text-sm text-white/60 font-medium">
                  New to selling on iPrime?{" "}
                  <Link
                    href="/help"
                    className="text-accent font-semibold hover:underline"
                  >
                    Browse the merchant guides
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
