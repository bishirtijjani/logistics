"use client";

import { useMemo, useRef, useState } from "react";
import {
  Search,
  ArrowRight,
  Utensils,
  ShoppingBasket,
  Pill,
  Store,
  Package,
  Smartphone,
  Star,
  Clock,
} from "lucide-react";
import { orderLink } from "../lib/links";
import HeroMap from "./HeroMap";

// Intent metadata, shared by the search suggestions and the quick-pick buttons.
// Slugs match pendingIntent.js in the customer app, so a pick resumes that
// exact flow after sign-in. Keep them in sync.
const INTENT_ICON = {
  food: Utensils,
  grocery: ShoppingBasket,
  pharmacy: Pill,
  shops: Store,
  package: Package,
  bills: Smartphone,
};

// Curated, instant suggestions. No backend call: the app's real search is
// auth + location gated, so matching it here would show items a logged-out
// visitor cannot act on. These map a typed phrase to the right launch intent.
const SUGGESTIONS = [
  { label: "Jollof rice", intent: "food", tag: "Food" },
  { label: "Suya & shawarma", intent: "food", tag: "Food" },
  { label: "Pizza & burgers", intent: "food", tag: "Food" },
  { label: "Groceries & provisions", intent: "grocery", tag: "Groceries" },
  { label: "Milk, bread & eggs", intent: "grocery", tag: "Groceries" },
  { label: "Paracetamol & drugs", intent: "pharmacy", tag: "Pharmacy" },
  { label: "Toiletries & first aid", intent: "pharmacy", tag: "Pharmacy" },
  { label: "Send a parcel across town", intent: "package", tag: "Parcel" },
  { label: "Airtime & data", intent: "bills", tag: "Bills" },
  { label: "Pay electricity bill", intent: "bills", tag: "Bills" },
];

// Category buttons styled like the customer app's Home tiles (white card +
// colored icon chip). Colors match the app's TILE_ACCENT palette (HomeScreen).
const chips = [
  { intent: "food", label: "Food", color: "#EA580C" },
  { intent: "grocery", label: "Groceries", color: "#65A30D" },
  { intent: "pharmacy", label: "Pharmacy", color: "#0D9488" },
  { intent: "shops", label: "Shops", color: "#4F46E5" },
  { intent: "package", label: "Send a parcel", color: "#09090b" },
  { intent: "bills", label: "Airtime & bills", color: "#2563EB" },
];

export default function Hero() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef(null);

  // Empty query shows a few popular picks; otherwise substring-filter. Capped
  // so the dropdown stays glanceable.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? SUGGESTIONS.filter((s) => s.label.toLowerCase().includes(q))
      : SUGGESTIONS;
    return pool.slice(0, 6);
  }, [query]);

  // Hand off to the app: chosen intent drives the flow, the typed text rides
  // along as `q` so the app can prefill its (real) search later.
  const go = (intent, q) => {
    const text = (q ?? query).trim();
    window.location.href = `${orderLink(intent)}${
      text ? `&q=${encodeURIComponent(text)}` : ""
    }`;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // Use the highlighted suggestion's intent when there is a match (so
    // "paracetamol" lands in Pharmacy, not Food); fall back to a food browse.
    const pick = results[active] || results[0];
    go(pick ? pick.intent : "food");
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <section className="relative pt-28 md:pt-32 pb-16 md:pb-24 overflow-hidden bg-[#ede2c9]">
      <div aria-hidden="true" className="absolute inset-0 -z-0">
        {/* Katsina city-map backdrop (street network, route + pins), faded so
            it sits behind the text rather than competing with it. */}
        <HeroMap className="absolute inset-0 w-full h-full opacity-[0.55]" />

        {/* Soft scrim behind the headline so text stays legible over the map
            without washing it out at the edges. Tinted to the map's sand. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 58% 52% at 50% 40%, rgba(248,243,231,0.92), rgba(248,243,231,0.35) 55%, transparent 75%)",
          }}
        />

        {/* Fade the lower edge into the page. */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
      </div>

      <div className="ui-container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl xl:text-7xl font-black tracking-tighter leading-[0.95] text-text-primary [text-shadow:0_2px_4px_rgba(0,0,0,0.18),0_6px_20px_rgba(0,0,0,0.28)]">
            Get <span className="text-accent">anything</span> delivered
            <br className="hidden sm:block" /> across Katsina.
          </h1>

          {/* Search: what do you want to buy. Live, curated suggestions. */}
          <form onSubmit={onSubmit} className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-white rounded-2xl sm:rounded-full p-2 shadow-xl border border-gray-200 focus-within:border-accent/50 transition-colors">
                <div className="flex items-center gap-2.5 flex-1 px-3">
                  <Search className="text-accent shrink-0" size={20} strokeWidth={2.5} />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setOpen(true);
                      setActive(0);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                      // Delay so a suggestion click registers before close.
                      blurTimer.current = setTimeout(() => setOpen(false), 120);
                    }}
                    onKeyDown={onKeyDown}
                    type="text"
                    placeholder="What do you want to buy?"
                    aria-label="What do you want to buy?"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="hero-search-list"
                    autoComplete="off"
                    className="w-full bg-transparent outline-none text-base text-text-primary placeholder:text-gray-400 py-2.5"
                  />
                </div>
                <button
                  type="submit"
                  className="ui-btn ui-btn-primary shrink-0 justify-center"
                >
                  Search
                  <ArrowRight size={18} strokeWidth={2.5} />
                </button>
              </div>

              {open && results.length > 0 && (
                <ul
                  id="hero-search-list"
                  role="listbox"
                  className="absolute z-20 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 list-none text-left"
                >
                  {results.map((s, i) => {
                    const Icon = INTENT_ICON[s.intent];
                    return (
                      <li key={s.label} role="option" aria-selected={i === active}>
                        <button
                          type="button"
                          // onMouseDown (not onClick) so it fires before the
                          // input's blur closes the list.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            clearTimeout(blurTimer.current);
                            go(s.intent, s.label);
                          }}
                          onMouseEnter={() => setActive(i)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-colors ${
                            i === active ? "bg-accent-dim" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-soft text-accent shrink-0">
                            <Icon size={16} strokeWidth={2.5} />
                          </span>
                          <span className="flex-1 text-sm font-semibold text-text-primary">
                            {s.label}
                          </span>
                          <span className="text-[0.7rem] font-bold uppercase tracking-wide text-gray-400">
                            {s.tag}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </form>

          {/* Quick-pick categories: app-style tiles, deep-link into a flow. */}
          <div className="mt-6">
            <p className="text-[0.7rem] font-bold uppercase tracking-widest text-gray-400 mb-3">
              Or jump straight to
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
              {chips.map((c) => {
                const Icon = INTENT_ICON[c.intent];
                return (
                  <a
                    key={c.intent}
                    href={orderLink(c.intent)}
                    className="group flex items-center gap-3 rounded-2xl bg-white border border-gray-200 px-3.5 py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300 transition-all cursor-pointer no-underline"
                  >
                    <span
                      className="flex items-center justify-center w-11 h-11 rounded-xl text-white shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105"
                      style={{ backgroundColor: c.color }}
                    >
                      <Icon size={20} strokeWidth={2.25} />
                    </span>
                    <span className="text-sm font-extrabold tracking-tight text-text-primary leading-tight">
                      {c.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="mt-7 flex items-center gap-5 justify-center text-sm text-gray-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <Star size={15} className="text-accent fill-accent" />
              Loved across Katsina
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={15} className="text-accent" />
              Minutes, not hours
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
