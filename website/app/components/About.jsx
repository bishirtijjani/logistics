"use client";

import { motion } from "framer-motion";
import { MapPin, Users, Bike, Store } from "lucide-react";

const stats = [
  { Icon: MapPin, value: "Katsina", label: "State coverage" },
  { Icon: Store, value: "Local", label: "Merchant partners" },
  { Icon: Bike, value: "Riders", label: "Earning on the platform" },
  { Icon: Users, value: "One app", label: "For every daily errand" },
];

export default function About() {
  return (
    <section className="ui-section bg-white" id="about">
      <div className="ui-container">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center">
          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-3xl bg-gradient-to-br from-[--color-accent-dim] to-[--color-bg-secondary] p-8 md:p-10 border border-[--color-accent-soft] overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.4]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, #ea580c20 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative grid grid-cols-2 gap-4">
                {stats.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl p-5"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center mb-3">
                      <s.Icon size={16} strokeWidth={2.5} />
                    </div>
                    <div className="text-xl font-black tracking-tight text-[--color-text-primary]">
                      {s.value}
                    </div>
                    <div className="text-xs text-gray-500 font-semibold mt-0.5">
                      {s.label}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="order-1 lg:order-2"
          >
            <span className="ui-eyebrow">About VTU Logistics</span>
            <h2 className="ui-title mb-6">
              Built in Katsina, <br />
              <span className="text-accent">for Katsina.</span>
            </h2>
            <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-5">
              VTU Logistics is a homegrown mobile super-app for the people of
              Katsina State — combining the wallet, utilities, and delivery
              services we use every day into one secure place.
            </p>
            <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-8">
              We work with local restaurants, supermarkets, pharmacies, and
              independent riders to keep money and goods moving inside the
              community, while making everyday tasks like paying for airtime or
              sending a parcel as effortless as a single tap.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border-l-2 border-accent pl-4">
                <div className="text-sm font-extrabold tracking-tight text-[--color-text-primary] mb-1">
                  For customers
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  One wallet, every service, real-time tracking.
                </div>
              </div>
              <div className="border-l-2 border-accent pl-4">
                <div className="text-sm font-extrabold tracking-tight text-[--color-text-primary] mb-1">
                  For merchants &amp; riders
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  More orders, instant settlements, less paperwork.
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
