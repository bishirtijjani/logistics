"use client";

import Image from "next/image";
import { useState } from "react";
import WaitlistModal from "./WaitlistModal";

const screens = [
  {
    src: "/images/home-screen.png",
    alt: "iPrime home — wallet balance, category tiles, active order",
    rotate: "-rotate-3",
    translate: "translate-y-4 md:translate-y-8",
    z: "z-10",
  },
  {
    src: "/images/orders-screen.png",
    alt: "My Orders — active deliveries from Mama Kachalla's, Suya King, KFC Katsina",
    rotate: "rotate-0",
    translate: "-translate-y-2 md:-translate-y-4",
    z: "z-20",
  },
  {
    src: "/images/map-screen.png",
    alt: "Live tracking — rider en route with 4-digit doorstep code",
    rotate: "rotate-3",
    translate: "translate-y-5 md:translate-y-10",
    z: "z-10",
  },
];

export default function Download() {
  const [modal, setModal] = useState({ open: false, platform: "UNKNOWN" });

  const openWaitlist = (platform) =>
    setModal({ open: true, platform });

  return (
    <section
      className="ui-section bg-text-primary text-white overflow-hidden relative"
      id="download"
    >
      <div className="ui-container relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex font-mono text-[0.7rem] uppercase tracking-widest px-3.5 py-1.5 rounded-full text-accent bg-accent/15 font-extrabold border border-accent/30 mb-5">
            Get the app
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter leading-[1.05] mb-6">
            Order, track, pay —{" "}
            <span className="text-accent">in your pocket.</span>
          </h2>

          <p className="text-base md:text-lg text-white/60 font-medium leading-relaxed mb-8 max-w-xl mx-auto">
            Available on iOS and Android. Sign up with your phone number and
            place your first delivery in under two minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-4 justify-center items-center">
            <button
              type="button"
              onClick={() => openWaitlist("IOS")}
              aria-label="Join the iOS waitlist"
              className="inline-block transition-transform hover:-translate-y-0.5 bg-transparent border-0 p-0 cursor-pointer"
            >
              <img
                src="/images/ios-app-store-btn.svg"
                alt="Download on the App Store"
                width={150}
                height={50}
                className="h-[50px] w-auto"
              />
            </button>

            <button
              type="button"
              onClick={() => openWaitlist("ANDROID")}
              aria-label="Join the Android waitlist"
              className="inline-block transition-transform hover:-translate-y-0.5 bg-transparent border-0 p-0 cursor-pointer"
            >
              <img
                src="/images/google-play-btn.svg"
                alt="Get it on Google Play"
                width={167}
                height={50}
                className="h-[50px] w-auto"
              />
            </button>
          </div>

          <p className="text-xs text-white/40 font-semibold">
            Coming soon — tap a button to join the launch waitlist.
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-[700px] aspect-square bg-accent/20 blur-[120px] rounded-full"
          />

          <div className="relative grid grid-cols-3 gap-2 sm:gap-4 md:gap-4 lg:gap-8 max-w-5xl mx-auto">
            {screens.map((s) => (
              <div
                key={s.src}
                className={`relative ${s.z} ${s.rotate} ${s.translate} transition-transform duration-500 hover:-translate-y-2 hover:rotate-0`}
              >
                <div className="relative rounded-2xl md:rounded-3xl lg:rounded-4xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                  <Image
                    src={s.src}
                    alt={s.alt}
                    width={740}
                    height={1600}
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 30vw, 32vw"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <WaitlistModal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        role="CUSTOMER"
        platform={modal.platform}
        source="/#download"
      />
    </section>
  );
}
