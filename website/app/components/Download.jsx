"use client";

import { motion } from "framer-motion";
import { Apple, Smartphone, QrCode } from "lucide-react";

export default function Download() {
  return (
    <section
      className="ui-section bg-[--color-text-primary] text-white overflow-hidden relative"
      id="download"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-0 opacity-30">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-accent/40 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-accent/30 rounded-full blur-[140px]" />
      </div>

      <div className="ui-container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex font-mono text-[0.7rem] uppercase tracking-widest px-3.5 py-1.5 rounded-full text-accent bg-accent/15 font-extrabold border border-accent/30 mb-5">
              Get the app
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter leading-[1.05] mb-6">
              Carry your wallet, bills, <br className="hidden md:block" />
              and deliveries{" "}
              <span className="text-accent">in your pocket.</span>
            </h2>

            <p className="text-base md:text-lg text-white/60 font-medium leading-relaxed mb-8 max-w-lg">
              Available on iOS and Android. Sign up with your phone number,
              fund your wallet, and start sending money or ordering deliveries
              in under two minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <a
                href="#"
                className="flex items-center gap-3 bg-white text-[--color-text-primary] px-6 py-3.5 rounded-2xl hover:bg-gray-100 transition-all no-underline"
              >
                <Apple
                  size={28}
                  strokeWidth={1.75}
                  className="fill-[--color-text-primary]"
                />
                <div>
                  <div className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-500">
                    Download on the
                  </div>
                  <div className="text-lg font-extrabold tracking-tight -mt-0.5">
                    App Store
                  </div>
                </div>
              </a>

              <a
                href="#"
                className="flex items-center gap-3 bg-white text-[--color-text-primary] px-6 py-3.5 rounded-2xl hover:bg-gray-100 transition-all no-underline"
              >
                <Smartphone size={26} strokeWidth={2} />
                <div>
                  <div className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-500">
                    Get it on
                  </div>
                  <div className="text-lg font-extrabold tracking-tight -mt-0.5">
                    Google Play
                  </div>
                </div>
              </a>
            </div>

            <div className="text-xs font-bold uppercase tracking-widest text-white/40">
              Launching soon — store badges are placeholders
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex justify-center"
          >
            <div className="relative">
              <div className="bg-white rounded-3xl p-8 text-center max-w-xs shadow-2xl">
                <div className="w-40 h-40 mx-auto rounded-2xl bg-[--color-bg-tertiary] border-2 border-dashed border-gray-300 flex items-center justify-center mb-5">
                  <QrCode
                    size={120}
                    strokeWidth={1.25}
                    className="text-[--color-text-primary]"
                  />
                </div>
                <div className="text-sm font-extrabold tracking-tight text-[--color-text-primary] mb-1">
                  Scan to install
                </div>
                <div className="text-xs text-gray-500 font-semibold">
                  Point your camera, tap the link, and the app downloads from
                  the right store automatically.
                </div>
              </div>

              <div className="absolute -top-3 -right-3 bg-accent text-white text-[0.65rem] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg shadow-accent/40">
                Easy install
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
