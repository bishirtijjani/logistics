import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { RIDER_URL } from "../lib/links";

// Rider entry CTA for the /riders hero. The rider app is live on the web with
// open signups, so this links straight to rider.iprime.ng (no store buttons,
// no waitlist). Sits on a dark photo hero, so styles suit a dark background.
export default function RiderDownloadButtons() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <a href={RIDER_URL} className="ui-btn ui-btn-primary justify-center">
          Start earning
          <ArrowUpRight size={18} strokeWidth={2.5} />
        </a>
        <a
          href="#requirements"
          className="ui-btn bg-white/10 border border-white/20 text-white hover:bg-white/15 hover:-translate-y-px justify-center"
        >
          See requirements
        </a>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-white/60 font-semibold">
        <ShieldCheck size={14} strokeWidth={2.5} className="text-accent" />
        Sign up at rider.iprime.ng. Most riders are approved within 24 hours.
      </p>
    </div>
  );
}
