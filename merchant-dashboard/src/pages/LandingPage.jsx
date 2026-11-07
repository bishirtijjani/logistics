import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Store,
  Menu,
  X,
  Sun,
  Moon,
  ArrowRight,
  CalendarClock,
  BadgeDollarSign,
  Truck,
  TrendingUp,
  ChefHat,
  ShoppingCart,
  Pill,
  ShoppingBag,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext.jsx";

const benefits = [
  {
    Icon: CalendarClock,
    title: "Daily payouts to your bank",
    body: "Settlements run every business morning for the prior day's orders. No 30-day net terms, no chasing payouts at month-end.",
  },
  {
    Icon: BadgeDollarSign,
    title: "No fixed monthly fee",
    body: "We earn only when you do - a percentage commission on orders Logistics Platform actually delivers. Slow week? You pay nothing.",
  },
  {
    Icon: Truck,
    title: "Riders included",
    body: "Every accepted order is auto-routed to a vetted Logistics Platform rider nearby. No fleet to hire, no parcels to chase.",
  },
  {
    Icon: TrendingUp,
    title: "We market with you",
    body: "Featured slots, push campaigns, and category banners built into the app and our launch calendar. We grow your basket.",
  },
];

const verticals = [
  {
    Icon: ChefHat,
    title: "Restaurants & street food",
    body: "From buka kitchens to QSR chains. We surface your menu and route every order to a nearby rider.",
  },
  {
    Icon: ShoppingCart,
    title: "Supermarkets & grocery",
    body: "List your aisles, set per-item availability, and accept basket orders with customer substitutions.",
  },
  {
    Icon: Pill,
    title: "Pharmacies",
    body: "Take prescription and OTC orders with built-in prescription upload and validity checks.",
  },
  {
    Icon: ShoppingBag,
    title: "Retail & specialty shops",
    body: "Phone accessories, beauty supplies, household goods. If it fits on a motorcycle, we deliver it.",
  },
];

const steps = [
  {
    n: "01",
    title: "Apply in five minutes",
    body: "Tell us about your business and upload your registration documents.",
  },
  {
    n: "02",
    title: "Build your listing",
    body: "Our team helps you upload your catalog, photograph hero items, and set hours.",
  },
  {
    n: "03",
    title: "Accept your first orders",
    body: "Orders land in the app. Confirm, prepare, and hand off to the assigned rider.",
  },
  {
    n: "04",
    title: "Get paid next morning",
    body: "End-of-day settlement lands in your bank by mid-morning, with full history in-app.",
  },
];

export default function LandingPage() {
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthenticated = Boolean(localStorage.getItem("token"));

  const navLinks = [
    { href: "#benefits", label: "Why Logistics Platform" },
    { href: "#categories", label: "Who we list" },
    { href: "#how-it-works", label: "How it works" },
  ];

  return (
    <div className="min-h-screen bg-background dark:bg-dark-background text-text dark:text-dark-text">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-surface-muted/70 dark:border-dark-surface-muted/70 bg-background/80 dark:bg-dark-background/80 backdrop-blur-md">
        <nav
          className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between"
          aria-label="Primary"
        >
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-white shadow-sm">
              <Store className="w-5 h-5" />
            </span>
            <span className="font-bold text-lg tracking-tight">
              Logistics Platform{" "}
              <span className="text-muted dark:text-dark-muted font-medium">
                Merchant
              </span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors duration-200 cursor-pointer"
              >
                {l.label}
              </a>
            ))}
            <a
              href="https:///help/merchant/set-up-your-shop"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors duration-200 cursor-pointer"
            >
              Guides
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-200 cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors duration-200 cursor-pointer"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-200 cursor-pointer"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="hidden sm:inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors duration-200 cursor-pointer"
                >
                  Register
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-200 cursor-pointer"
            >
              {menuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background px-4 py-4 space-y-1">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-3 rounded-lg text-base font-medium text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-200 cursor-pointer"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="w-full text-center bg-primary text-white px-4 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors duration-200 cursor-pointer"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="w-full text-center border border-surface-muted dark:border-dark-surface-muted px-4 py-3 rounded-lg font-semibold hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-200 cursor-pointer"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="w-full text-center bg-primary text-white px-4 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors duration-200 cursor-pointer"
                  >
                    Register your business
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden flex items-center min-h-[560px] md:min-h-[680px]">
          <img
            src="/images/audience-merchant.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center -scale-x-100"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/25"
          />
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-20 md:py-28 relative z-10">
            <div className="max-w-2xl text-white">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-4">
                For merchants
              </span>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6">
                Sell to your city,
                <br />
                <span className="text-primary">straight from your phone.</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 font-medium leading-relaxed max-w-xl mb-8">
                Plug your restaurant, supermarket, pharmacy, or retail shop into
                the Logistics Platform customer base. We handle delivery, payments, and
                support - you focus on what you make.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3.5 rounded-lg font-semibold hover:bg-primary-700 focus:ring-4 focus:ring-primary/30 transition-colors duration-200 cursor-pointer"
                >
                  Register your business
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-lg font-semibold border border-white/25 text-white hover:bg-white/10 transition-colors duration-200 cursor-pointer bg-white/10"
                >
                  Sign in
                </a>
              </div>
              <p className="mt-6 text-sm text-white/70">
                Already onboarded?{" "}
                <Link
                  to="/login"
                  className="text-primary font-semibold hover:text-primary-400 cursor-pointer"
                >
                  Sign in to your dashboard
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section
          id="benefits"
          className="py-16 md:py-24 bg-surface dark:bg-dark-surface border-y border-surface-muted dark:border-dark-surface-muted"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="max-w-2xl mb-12">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">
                Why merchants choose Logistics Platform
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Four reasons, in plain terms.
              </h2>
            </header>
            <div className="grid sm:grid-cols-2 gap-5">
              {benefits.map((b) => (
                <article
                  key={b.title}
                  className="bg-background dark:bg-dark-background border border-surface-muted dark:border-dark-surface-muted rounded-2xl p-7 hover:border-primary/40 hover:shadow-lg transition-colors duration-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center mb-5">
                    <b.Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight mb-2">
                    {b.title}
                  </h3>
                  <p className="text-muted dark:text-dark-muted font-medium leading-relaxed">
                    {b.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Categories */}
        <section id="categories" className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="max-w-2xl mb-12">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">
                Who we list
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Four categories, live across the app.
              </h2>
            </header>
            <div className="grid sm:grid-cols-2 gap-5">
              {verticals.map((v) => (
                <article
                  key={v.title}
                  className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-2xl p-7 hover:border-primary/40 hover:shadow-lg transition-colors duration-200"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center mb-4 shadow-sm">
                    <v.Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight mb-2">
                    {v.title}
                  </h3>
                  <p className="text-muted dark:text-dark-muted font-medium leading-relaxed">
                    {v.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="py-16 md:py-24 bg-surface dark:bg-dark-surface border-y border-surface-muted dark:border-dark-surface-muted"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="max-w-2xl mb-12">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">
                How it works
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                From application to first payout.
              </h2>
              <p className="mt-3 text-muted dark:text-dark-muted font-medium">
                We aim to take most new merchants from application to live
                listing in under one business week.
              </p>
            </header>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {steps.map((s) => (
                <article
                  key={s.n}
                  className="bg-background dark:bg-dark-background border border-surface-muted dark:border-dark-surface-muted rounded-2xl p-6"
                >
                  <div className="text-xs font-mono font-extrabold text-primary mb-3">
                    {s.n}
                  </div>
                  <h3 className="text-base font-bold tracking-tight mb-2">
                    {s.title}
                  </h3>
                  <p className="text-sm text-muted dark:text-dark-muted font-medium leading-relaxed">
                    {s.body}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-10">
              <a
                href="https:///help/merchant/set-up-your-shop"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-200 cursor-pointer"
              >
                Read the step-by-step merchant guide
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl bg-secondary text-white p-8 md:p-14">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/30 blur-3xl"
              />
              <div className="relative max-w-2xl">
                <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">
                  Get started
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-[1.1] mb-4">
                  Ready to go live?
                </h2>
                <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed mb-8">
                  Register your business in minutes. Our merchant success team
                  will help you build your listing and get you taking orders.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3.5 rounded-lg font-semibold hover:bg-primary-700 focus:ring-4 focus:ring-primary/30 transition-colors duration-200 cursor-pointer"
                  >
                    Register your business
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-lg font-semibold border border-white/20 text-white hover:bg-white/10 transition-colors duration-200 cursor-pointer"
                  >
                    Sign in
                  </Link>
                </div>
                <div className="mt-6 flex items-center gap-2 text-sm text-white/60 font-medium">
                  <Smartphone className="w-4 h-4 text-primary" />
                  Merchant app available on iOS and Android.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-muted dark:border-dark-surface-muted py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted dark:text-dark-muted">
            <Store className="w-4 h-4 text-primary" />
            <span>
              © {new Date().getFullYear()} Logistics Platform. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a
              href="https:///help/merchant/set-up-your-shop"
              target="_blank"
              rel="noreferrer"
              className="text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors duration-200 cursor-pointer"
            >
              Guides
            </a>
            <Link
              to="/login"
              className="text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors duration-200 cursor-pointer"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors duration-200 cursor-pointer"
            >
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
