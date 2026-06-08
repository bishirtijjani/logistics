import Image from "next/image";
import { ArrowUpRight, Truck } from "lucide-react";
import { APP_URL, RIDER_URL } from "../lib/links";

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
  return (
    <section
      className="ui-section bg-text-primary text-white overflow-hidden relative"
      id="download"
    >
      <div className="ui-container relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex font-mono text-[0.7rem] uppercase tracking-widest px-3.5 py-1.5 rounded-full text-accent bg-accent/15 font-extrabold border border-accent/30 mb-5">
            Get started
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter leading-[1.05] mb-6">
            Order, track, pay —{" "}
            <span className="text-accent">in your browser.</span>
          </h2>

          <p className="text-base md:text-lg text-white/60 font-medium leading-relaxed mb-8 max-w-xl mx-auto">
            No install needed — iPrime runs right on the web. Sign up with your
            phone number and place your first delivery in under two minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-4 justify-center items-center">
            <a
              href={APP_URL}
              className="ui-btn ui-btn-primary"
            >
              Open the customer app
              <ArrowUpRight size={18} strokeWidth={2.5} />
            </a>

            <a
              href={RIDER_URL}
              className="ui-btn bg-white/10 border border-white/20 text-white hover:bg-white/15 hover:-translate-y-px"
            >
              <Truck size={18} strokeWidth={2.5} />
              Deliver with iPrime
            </a>
          </div>

          <p className="text-xs text-white/40 font-semibold">
            Works on any phone or computer — iOS &amp; Android apps coming soon.
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
    </section>
  );
}
