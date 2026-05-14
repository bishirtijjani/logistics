"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Wallet,
  Zap,
  Package,
  MapPin,
} from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-36 pb-20 md:pt-40 md:pb-24 overflow-hidden bg-[--color-bg-secondary]">
      {/* Decorative grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      >
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="ui-container">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <div className="ui-badge mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mr-2 animate-pulse" />
              Built for Katsina State
            </div>

            <h1 className="text-4xl md:text-5xl xl:text-[3.75rem] font-black mb-6 tracking-tighter leading-[1.02] text-[--color-text-primary]">
              Your wallet, bills,{" "}
              <span className="text-accent">and deliveries</span> —{" "}
              <br className="hidden md:block" />
              in one app.
            </h1>

            <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed font-medium max-w-xl mx-auto lg:mx-0">
              Send money, pay for airtime, data and electricity, and order food
              or packages with live rider tracking — all from a single mobile
              super-app.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center mb-10">
              <a href="#download" className="ui-btn ui-btn-primary">
                Download the App
                <ArrowRight size={18} strokeWidth={2.5} />
              </a>
              <a href="#how-it-works" className="ui-btn ui-btn-ghost">
                See how it works
              </a>
            </div>

            <ul className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-gray-500 list-none p-0">
              <li className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-accent" />
                Free to download
              </li>
              <li className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-accent" />
                Real-time tracking
              </li>
              <li className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-accent" />
                Secure wallet
              </li>
            </ul>
          </motion.div>

          {/* Phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            className="relative flex justify-center"
            aria-hidden="true"
          >
            <div className="relative w-[280px] md:w-[320px] aspect-[9/19] rounded-[2.75rem] bg-[--color-text-primary] p-3 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.35)]">
              <div className="absolute left-1/2 -translate-x-1/2 top-3 w-28 h-6 bg-[--color-text-primary] rounded-b-2xl z-20" />
              <div className="w-full h-full bg-[--color-bg-secondary] rounded-[2.25rem] overflow-hidden relative flex flex-col">
                <div className="h-10 px-6 flex items-center justify-between text-[10px] font-bold text-[--color-text-primary] pt-2">
                  <span>9:41</span>
                  <span className="flex gap-1 items-center">
                    <span className="w-3 h-1.5 rounded-sm bg-[--color-text-primary]" />
                    <span className="w-3 h-1.5 rounded-sm bg-[--color-text-primary]" />
                    <span className="w-4 h-2 rounded-sm border-2 border-[--color-text-primary]" />
                  </span>
                </div>

                <div className="mx-4 mt-2 rounded-2xl bg-accent text-white p-4">
                  <div className="text-[10px] uppercase tracking-widest opacity-80 font-bold">
                    Wallet Balance
                  </div>
                  <div className="text-2xl font-black mt-1">₦ 84,250.00</div>
                  <div className="flex gap-2 mt-3">
                    <div className="bg-white/15 rounded-lg px-2.5 py-1 text-[10px] font-bold">
                      + Top up
                    </div>
                    <div className="bg-white/15 rounded-lg px-2.5 py-1 text-[10px] font-bold">
                      Send
                    </div>
                  </div>
                </div>

                <div className="mx-4 mt-4 grid grid-cols-4 gap-2">
                  {[
                    { Icon: Zap, label: "Airtime" },
                    { Icon: Wallet, label: "Data" },
                    { Icon: Package, label: "Send" },
                    { Icon: MapPin, label: "Track" },
                  ].map(({ Icon, label }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-[--color-text-primary]">
                        <Icon size={16} strokeWidth={2.5} />
                      </div>
                      <span className="text-[9px] font-bold text-[--color-text-primary]">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mx-4 mt-4 flex-1 space-y-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">
                    Active Order
                  </div>
                  <div className="rounded-2xl bg-white border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent">
                        En route
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        12 min
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[--color-text-primary] mb-2">
                      Suya Spot · 2 items
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full w-2/3 bg-accent rounded-full" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">
                        ₦3,400
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white border border-gray-200 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                        Electricity · Kano Disco
                      </div>
                      <div className="text-xs font-bold text-[--color-text-primary]">
                        ₦5,000 · token sent
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 size={14} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>

                <div className="mx-4 my-3 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-around px-4">
                  {[Wallet, Package, Zap, MapPin].map((Icon, i) => (
                    <Icon
                      key={i}
                      size={16}
                      strokeWidth={2.5}
                      className={i === 0 ? "text-accent" : "text-gray-300"}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute inset-0 -z-10 bg-accent/20 blur-[80px] rounded-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
