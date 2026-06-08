import {
  Utensils,
  ShoppingBasket,
  Pill,
  Store,
  Package,
  Smartphone,
  ArrowUpRight,
  Star,
} from "lucide-react";
import { APP_URL, orderLink } from "../lib/links";

// Mirrors the in-app Home grid (mobile/customer-app HomeScreen) and the intent
// slugs honoured by pendingIntent.js. Tap a card → app.iprime.ng resumes into
// that exact flow after sign-in. Colors match the app's TILE_ACCENT palette.
const categories = [
  { intent: "food", label: "Food", sub: "Restaurants", Icon: Utensils, color: "#EA580C" },
  { intent: "grocery", label: "Groceries", sub: "Supermarkets", Icon: ShoppingBasket, color: "#65A30D" },
  { intent: "pharmacy", label: "Pharmacy", sub: "Chemists", Icon: Pill, color: "#0D9488" },
  { intent: "shops", label: "Shops", sub: "Everything else", Icon: Store, color: "#4F46E5" },
  { intent: "package", label: "Send a parcel", sub: "Across town", Icon: Package, color: "#09090b" },
  { intent: "bills", label: "Airtime & bills", sub: "Top-up & pay", Icon: Smartphone, color: "#2563EB" },
];

export default function Hero() {
  return (
    <section className="relative pt-36 md:pt-44 pb-16 md:pb-20 overflow-hidden bg-accent-dim">
      {/* Ambient brand wash — soft blurred blobs behind the content. */}
      <div aria-hidden="true" className="absolute inset-0 -z-0">
        <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-accent/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-[24rem] h-[24rem] rounded-full bg-emerald-400/10 blur-[120px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
      </div>

      <div className="ui-container relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <span className="ui-badge">Now live across Katsina</span>

          <h1 className="mt-5 text-4xl md:text-6xl xl:text-7xl font-black tracking-tighter leading-[1.0] text-text-primary">
            What do you need <span className="text-accent">today?</span>
          </h1>

          <p className="mt-5 text-lg md:text-xl text-gray-600 font-medium leading-relaxed max-w-2xl mx-auto">
            Food, groceries, pharmacy and parcels — delivered across Katsina by a
            nearby rider, tracked live to your door. Plus airtime, data and bills
            from one wallet. Pick a category to get started.
          </p>
        </div>

        {/* The hero interaction: tap a category to start an order. */}
        <div className="mt-10 md:mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 max-w-5xl mx-auto">
          {categories.map((c) => (
            <a
              key={c.intent}
              href={orderLink(c.intent)}
              className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-gray-200 px-3 py-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-gray-300 cursor-pointer no-underline min-h-[140px]"
            >
              <ArrowUpRight
                size={16}
                strokeWidth={2.5}
                className="absolute top-3 right-3 text-gray-300 opacity-0 -translate-y-0.5 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:text-accent"
              />
              <span
                className="flex items-center justify-center w-14 h-14 rounded-2xl text-white shadow-sm transition-transform duration-200 group-hover:scale-105"
                style={{ backgroundColor: c.color }}
              >
                <c.Icon size={26} strokeWidth={2.25} />
              </span>
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-extrabold tracking-tight text-text-primary text-center leading-tight">
                  {c.label}
                </span>
                <span className="text-[0.7rem] font-semibold text-gray-400 text-center">
                  {c.sub}
                </span>
              </span>
            </a>
          ))}
        </div>

        {/* Trust + fallback entry for anyone who doesn't want to pick a tile. */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
          <a
            href={APP_URL}
            className="ui-btn ui-btn-primary"
          >
            Open the web app
            <ArrowUpRight size={18} strokeWidth={2.5} />
          </a>
          <p className="flex items-center gap-2 text-sm text-gray-500 font-semibold">
            <Star size={15} className="text-accent fill-accent" />
            Sign in once — you&apos;ll pick up right where you tapped.
          </p>
        </div>
      </div>
    </section>
  );
}
