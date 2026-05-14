"use client";

import { motion } from "framer-motion";
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
    icon: Wallet,
    title: "Digital Wallet",
    blurb:
      "Fund your wallet from any Nigerian bank, send money to anyone on VTU Logistics in seconds, and withdraw back to your account anytime.",
    bullets: [
      { Icon: Banknote, label: "Virtual bank account on signup" },
      { Icon: ShieldCheck, label: "Transaction PIN authorization" },
      { Icon: Radio, label: "Real-time transfer notifications" },
    ],
  },
  {
    icon: Zap,
    title: "Utility Payments",
    blurb:
      "Recharge airtime, buy data, and pay electricity bills across every Nigerian network and DISCO. Tokens delivered the moment payment clears.",
    bullets: [
      { Icon: Radio, label: "MTN, Airtel, Glo, 9mobile" },
      { Icon: Lightbulb, label: "All DISCO electricity prepaid & postpaid" },
      { Icon: ShieldCheck, label: "Automatic refund on failed delivery" },
    ],
  },
  {
    icon: Package,
    title: "On-Demand Delivery",
    blurb:
      "From a hot meal to a courier package, order it in the app and watch a nearby rider deliver it to your door — live GPS the whole way.",
    bullets: [
      { Icon: Utensils, label: "Food from local restaurants" },
      { Icon: ShoppingBasket, label: "Groceries and pharmacy" },
      { Icon: Pill, label: "Courier packages across town" },
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
            Three apps&apos; worth of services,{" "}
            <span className="text-accent">one tap away.</span>
          </h2>
          <p className="ui-sub mx-auto">
            We built VTU Logistics as a true super-app — your wallet, your bill
            payments, and your daily deliveries all share the same login,
            balance, and tracking history.
          </p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p, i) => (
            <motion.article
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="ui-card group hover:border-accent/40 hover:shadow-lg hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-[--color-accent-dim] flex items-center justify-center text-accent mb-5 group-hover:bg-accent group-hover:text-white transition-colors duration-300">
                <p.icon size={22} strokeWidth={2.25} />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-[--color-text-primary] mb-3">
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
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
