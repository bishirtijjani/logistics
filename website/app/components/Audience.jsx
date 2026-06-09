import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const audiences = [
  {
    eyebrow: "For customers",
    title: "Anything you need, at your door.",
    blurb:
      "One app for food, groceries, pharmacy and parcels - paid from a wallet that also covers your airtime and bills.",
    cta: { label: "Download iPrime", href: "#download" },
    image: "/images/audience-customer.png",
    fallback: "bg-orange-500",
    kenburns: "ken-burns-a",
    duration: 28,
  },
  {
    eyebrow: "For merchants",
    title: "Plug into Katsina's hungriest customers.",
    blurb:
      "Get listed, accept orders from your phone, settle to your bank daily. We push every order to a nearby rider for you.",
    cta: { label: "List your business", href: "/merchants" },
    image: "/images/audience-merchant.png",
    fallback: "bg-emerald-600",
    kenburns: "ken-burns-b",
    duration: 34,
  },
  {
    eyebrow: "For riders",
    title: "Become A Rider. Get paid same-day.",
    blurb:
      "Accept jobs near you, deliver, settle. Earnings reflect instantly in your iPrime wallet - withdraw anytime.",
    cta: { label: "Apply to ride", href: "/riders" },
    image: "/images/audience-rider.png",
    fallback: "bg-zinc-800",
    kenburns: "ken-burns-c",
    duration: 31,
  },
];

export default function Audience() {
  return (
    <section className="ui-section bg-white" id="partners">
      <div className="ui-container">
        <header className="text-center max-w-2xl mx-auto mb-16">
          <span className="ui-eyebrow">Built for three sides</span>
          <h2 className="ui-title">
            Customers, merchants{" "}
            <span className="text-accent">and riders.</span>
          </h2>
          <p className="ui-sub mx-auto">
            Every order on iPrime is a handshake between three apps. Here&apos;s
            what each side gets.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {audiences.map((a) => (
            <article
              key={a.eyebrow}
              className={`group relative aspect-[3/4] rounded-3xl overflow-hidden ${a.fallback} shadow-xl shadow-black/10 transition-transform duration-500 hover:-translate-y-2`}
            >
              {/* Background photo with ambient Ken Burns motion */}
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{
                    animation: `${a.kenburns} ${a.duration}s cubic-bezier(0.45, 0, 0.55, 1) infinite`,
                  }}
                >
                  <Image
                    src={a.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              </div>

              {/* Gradient overlay for legibility */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/3"
              />

              {/* Content overlay */}
              <div className="absolute inset-0 z-10 p-6 lg:p-8 flex flex-col justify-end text-white">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-accent font-extrabold mb-3 block">
                  {a.eyebrow}
                </span>
                <h3 className="text-2xl lg:text-3xl font-black tracking-tight leading-[1.05] mb-3">
                  {a.title}
                </h3>
                <p className="text-sm lg:text-base text-white/80 font-medium leading-relaxed mb-6 max-w-[28ch]">
                  {a.blurb}
                </p>
                <a
                  href={a.cta.href}
                  className="inline-flex items-center gap-2 self-start bg-white text-text-primary text-sm font-extrabold px-4 py-2.5 rounded-full hover:bg-accent hover:text-white transition-colors duration-300 no-underline"
                >
                  {a.cta.label}
                  <ArrowUpRight
                    size={14}
                    strokeWidth={2.5}
                    className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                  />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
