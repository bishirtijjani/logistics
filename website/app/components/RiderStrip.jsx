import { Bike, ArrowUpRight } from "lucide-react";
import { RIDER_URL } from "../lib/links";

// Slim rider entry band on the homepage. The hero is customer-first; this gives
// riders a visible path near the top without crowding it. Primary CTA opens the
// live rider app (rider.iprime.ng); secondary goes to the /riders detail page.
export default function RiderStrip() {
  return (
    <section className="py-10 md:py-14 bg-white">
      <div className="ui-container">
        <div className="relative overflow-hidden rounded-3xl bg-text-primary text-white px-6 py-8 md:px-10 md:py-9">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-accent/25 blur-[90px]"
          />

          <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
            <div className="flex items-center gap-4 flex-1">
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-accent text-white shrink-0 shadow-md">
                <Bike size={24} strokeWidth={2.25} />
              </span>
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight leading-tight">
                  Are you a rider? Earn on your own schedule.
                </h2>
                <p className="mt-1 text-sm md:text-base text-white/60 font-medium leading-relaxed">
                  Accept jobs near you and get paid to your wallet the moment you
                  deliver. Approved in about 24 hours.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a href={RIDER_URL} className="ui-btn ui-btn-primary justify-center">
                Start earning
                <ArrowUpRight size={18} strokeWidth={2.5} />
              </a>
              <a
                href="/riders"
                className="ui-btn bg-white/10 border border-white/20 text-white hover:bg-white/15 hover:-translate-y-px justify-center"
              >
                How it works
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
