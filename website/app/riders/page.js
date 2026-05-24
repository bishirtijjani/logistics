import Image from "next/image";
import {
  BadgeDollarSign,
  Bike,
  CheckCircle2,
  Clock,
  FileText,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import RiderDownloadButtons from "../components/RiderDownloadButtons";

export const metadata = {
  title: "For riders",
  description:
    "Earn delivering for iPrime in Katsina. Choose your hours, accept jobs near you, and withdraw to your bank the same day. Apply through the iPrime Rider app.",
  alternates: { canonical: "/riders" },
};

const earnings = [
  {
    Icon: BadgeDollarSign,
    title: "Per-trip fares.",
    body: "Every accepted job pays a base fare plus distance. Fares are shown to you before you accept — you never deliver without knowing what you'll earn.",
  },
  {
    Icon: Wallet,
    title: "Instant payout to your wallet.",
    body: "Your earnings hit your iPrime Rider wallet the moment a customer marks the order delivered. No 30-day pay cycle; no waiting for end-of-week settlement.",
  },
  {
    Icon: Star,
    title: "Tips, all yours.",
    body: "Customers can add a tip after delivery. Every naira of every tip goes directly to you — iPrime takes 0% on tips.",
  },
  {
    Icon: Clock,
    title: "Your own hours.",
    body: "Go online when you want to work; go offline when you're done. There's no shift, no quota, no boss texting you about your schedule.",
  },
];

const appFeatures = [
  {
    Icon: Navigation,
    title: "Live job matching.",
    body: "Jobs pop up based on your live GPS — usually you only see offers within a 2 km pickup radius.",
  },
  {
    Icon: Phone,
    title: "Masked customer calls.",
    body: "Tap to call the customer or merchant; we mask both numbers so neither side ever sees the other's real digits.",
  },
  {
    Icon: ShieldCheck,
    title: "Trip safety controls.",
    body: "Built-in panic button, trip recording, and a daily check-in. Every trip's GPS history is kept for 30 days for dispute resolution.",
  },
];

const onboarding = [
  {
    n: "01",
    title: "Download the app & sign up.",
    body: "iPrime Rider is on iOS and Android. Create an account with your phone number; you'll go through OTP verification.",
  },
  {
    n: "02",
    title: "Pass KYC.",
    body: "Upload your driver's licence, vehicle papers, a clear selfie, and confirm your BVN. Most riders are approved within 24 business hours.",
  },
  {
    n: "03",
    title: "Complete the safety briefing.",
    body: "A short in-app walkthrough covers helmet rules, customer etiquette, and the iPrime rider Code of Conduct. Mandatory before your first job.",
  },
  {
    n: "04",
    title: "Go online & accept your first job.",
    body: "Tap \"Go online\" from the home tab and watch the job feed. Most new riders get matched within the first 30 minutes during peak hours.",
  },
];

const requirements = [
  "A motorcycle in good working condition (your own — we don't lease vehicles).",
  "A valid Nigerian driver's licence with motorcycle endorsement (Class A).",
  "Up-to-date vehicle papers: registration, insurance, roadworthiness certificate.",
  "A helmet — non-negotiable. You can't go online without one.",
  "A smartphone (Android 9+ / iOS 14+) with a working data plan.",
  "A bank account in your name (we credit your wallet, you withdraw from there).",
  "Valid BVN. Required for the wallet — no BVN, no payouts.",
];

export default function RidersPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative min-h-[100svh] flex items-end pt-32 pb-16 md:pb-20 overflow-hidden">
          <Image
            src="/images/audience-rider.png"
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
              <span className="ui-eyebrow">For riders</span>
              <h1 className="text-4xl md:text-5xl xl:text-[3.5rem] font-black tracking-tighter leading-[1.05] mb-6 text-white">
                Ride your own hours.{" "}
                <span className="text-accent">Get paid same-day.</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 font-medium leading-relaxed max-w-2xl mb-8">
                iPrime is a delivery platform for independent motorcycle
                riders in Katsina. Accept jobs near you, deliver, and watch
                your earnings land in your wallet the second the customer
                receives the order. Withdraw to any Nigerian bank, anytime.
              </p>

              <RiderDownloadButtons />
            </div>
          </div>
        </section>

        <section className="ui-section bg-white">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">How you earn</span>
              <h2 className="ui-title">
                Four lines on{" "}
                <span className="text-accent">the money side.</span>
              </h2>
              <p className="ui-sub">
                We're a platform that connects you to delivery work —
                you're an independent contractor, not an iPrime employee.
                That means flexibility, and it also means you keep what you
                earn.
              </p>
            </header>

            <div className="grid md:grid-cols-2 gap-5">
              {earnings.map((e) => (
                <article
                  key={e.title}
                  className="ui-card hover:border-accent/40 hover:shadow-lg transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center mb-4 shadow-md">
                    <e.Icon size={20} strokeWidth={2.25} />
                  </div>
                  <h3 className="text-lg md:text-xl font-extrabold tracking-tight text-text-primary mb-2">
                    {e.title}
                  </h3>
                  <p className="text-gray-500 font-medium leading-relaxed">
                    {e.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section bg-bg-secondary">
          <div className="ui-container">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">
              <div>
                <span className="ui-eyebrow">The Rider app</span>
                <h2 className="ui-title mb-6">
                  Built for working{" "}
                  <span className="text-accent">on a motorcycle.</span>
                </h2>
                <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed">
                  Large tap targets, screen-bright navigation, voice-guided
                  pickup and dropoff, and a one-tap panic button. Every
                  screen is designed for a rider in motion, not someone at a
                  desk.
                </p>
              </div>

              <div className="grid gap-4">
                {appFeatures.map((f) => (
                  <article
                    key={f.title}
                    className="bg-white border border-gray-200 rounded-2xl p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-accent-dim text-accent flex items-center justify-center shrink-0">
                        <f.Icon size={18} strokeWidth={2.25} />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold tracking-tight text-text-primary mb-1 leading-snug">
                          {f.title}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium leading-relaxed">
                          {f.body}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="ui-section bg-white">
          <div className="ui-container">
            <header className="max-w-2xl mb-12">
              <span className="ui-eyebrow">Onboarding</span>
              <h2 className="ui-title">
                From signup to{" "}
                <span className="text-accent">your first delivery.</span>
              </h2>
              <p className="ui-sub">
                Most riders complete the full flow in under 48 hours,
                including KYC review.
              </p>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {onboarding.map((s) => (
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
          </div>
        </section>

        <section className="ui-section bg-bg-secondary" id="requirements">
          <div className="ui-container">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
              <div>
                <span className="ui-eyebrow">Requirements</span>
                <h2 className="ui-title mb-6">
                  What you need{" "}
                  <span className="text-accent">to start riding.</span>
                </h2>
                <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-6">
                  iPrime is for independent riders. You bring your bike, your
                  licence, and your time; we bring the customers, the
                  navigation, and the payout rail. If you're missing
                  one of the items on this list, ask us — we may be able to
                  point you to a partner.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500 font-semibold">
                  <Bike size={16} strokeWidth={2.5} className="text-accent" />
                  We don't lease vehicles. Your bike, your business.
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-7 md:p-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-text-primary text-white flex items-center justify-center">
                    <FileText size={18} strokeWidth={2.25} />
                  </div>
                  <div className="text-base font-extrabold tracking-tight text-text-primary">
                    Rider checklist
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

      </main>
      <Footer />
    </>
  );
}
