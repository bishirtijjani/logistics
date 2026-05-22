import {
  Wallet,
  Zap,
  Package,
  ShieldCheck,
  Radio,
  Banknote,
  Lightbulb,
  Pill,
  ShoppingBasket,
  Utensils,
} from "lucide-react";

const pillars = [
  {
    icon: Package,
    tint: "bg-orange-500",
    title: "Food, Groceries & Parcels",
    blurb:
      "Order from local restaurants, supermarkets and pharmacies across Katsina. Or send a package across town with a nearby rider — live GPS the whole way.",
    bullets: [
      { Icon: Utensils, label: "Suya, jollof, and everything between" },
      { Icon: ShoppingBasket, label: "Groceries and pharmacy" },
      { Icon: Pill, label: "Courier across the city" },
    ],
  },
  {
    icon: Wallet,
    tint: "bg-emerald-500",
    title: "Wallet & Transfers",
    blurb:
      "Pay for what's delivered straight from your iPrime balance. Get a virtual NUBAN on signup, fund from any Nigerian bank, send to anyone on iPrime in seconds.",
    bullets: [
      { Icon: Banknote, label: "Virtual account on signup" },
      { Icon: ShieldCheck, label: "PIN-protected transactions" },
      { Icon: Radio, label: "Instant credit notifications" },
    ],
  },
  {
    icon: Zap,
    tint: "bg-amber-500",
    title: "Airtime, Data & Bills",
    blurb:
      "Same balance covers your everyday bills. Recharge MTN, Airtel, Glo and 9mobile, buy data, pay any DISCO — tokens land in SMS the moment payment clears.",
    bullets: [
      { Icon: Radio, label: "MTN, Airtel, Glo, 9mobile" },
      { Icon: Lightbulb, label: "Every Nigerian DISCO" },
      { Icon: ShieldCheck, label: "Auto-refund on failure" },
    ],
  },
];

export default function Features() {
  return (
    <section className="ui-section bg-white" id="features">
      <div className="ui-container">
        <header className="text-center max-w-2xl mx-auto mb-16">
          <span className="ui-eyebrow">What&apos;s inside</span>
          <h2 className="ui-title">
            Delivery first.{" "}
            <span className="text-accent">Everything else, included.</span>
          </h2>
          <p className="ui-sub mx-auto">
            iPrime is built around getting things to your door. The wallet and
            bill payments share the same balance so you never juggle apps to
            pay for what you ordered.
          </p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p) => (
            <article
              key={p.title}
              className="ui-card group hover:border-accent/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-12 h-12 rounded-2xl ${p.tint} flex items-center justify-center text-white mb-5 shadow-sm`}
              >
                <p.icon size={22} strokeWidth={2.25} />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-text-primary mb-3">
                {p.title}
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-6">
                {p.blurb}
              </p>
              <ul className="space-y-2.5 border-t border-gray-100 pt-5">
                {p.bullets.map(({ Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 text-sm text-gray-600 font-semibold"
                  >
                    <Icon
                      size={15}
                      strokeWidth={2.5}
                      className="text-accent shrink-0"
                    />
                    {label}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
