"use client";

import { motion } from "framer-motion";
import {
  Smartphone,
  ShoppingBag,
  Bike,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    Icon: Smartphone,
    label: "Step 01",
    title: "Order in the app",
    desc: "Open VTU Logistics, pick what you need — a meal, groceries, a package pickup, or a utility recharge — and pay from your wallet.",
  },
  {
    Icon: ShoppingBag,
    label: "Step 02",
    title: "Merchant gets to work",
    desc: "Your local restaurant, supermarket, or pharmacy is notified instantly and starts preparing your order while the system finds a nearby rider.",
  },
  {
    Icon: Bike,
    label: "Step 03",
    title: "Live rider tracking",
    desc: "An available rider accepts the job and you see them move on the map in real-time, with ETA updates every few seconds.",
  },
  {
    Icon: CheckCircle2,
    label: "Step 04",
    title: "Delivered & settled",
    desc: "When the rider hands off your order, the wallet automatically settles the merchant, the rider, and the platform. You leave a rating.",
  },
];

export default function HowItWorks() {
  return (
    <section
      className="ui-section bg-[--color-bg-secondary]"
      id="how-it-works"
    >
      <div className="ui-container">
        <header className="text-center max-w-2xl mx-auto mb-16">
          <span className="ui-eyebrow">How it works</span>
          <h2 className="ui-title">
            From tap to doorstep,{" "}
            <span className="text-accent">in four steps.</span>
          </h2>
          <p className="ui-sub mx-auto">
            Every order — food, groceries, pharmacy, or package — runs through
            the same lifecycle, so you always know exactly where things stand.
          </p>
        </header>

        <div className="relative">
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"
          />

          <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 list-none p-0">
            {steps.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative bg-white border border-gray-200 rounded-2xl p-6 hover:border-accent/40 transition-all"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-md shadow-accent/20">
                    <s.Icon size={20} strokeWidth={2.25} />
                  </div>
                  <span className="font-mono text-[0.7rem] uppercase tracking-widest text-gray-400 font-bold">
                    {s.label}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold tracking-tight text-[--color-text-primary] mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  {s.desc}
                </p>

                {i < steps.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    size={18}
                    strokeWidth={2.5}
                    className="hidden lg:block absolute -right-3 top-12 text-gray-300 bg-[--color-bg-secondary] rounded-full"
                  />
                )}
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
