"use client";

import { Menu, X, ArrowRight, Truck } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { name: "Features", href: "#features" },
  { name: "How it works", href: "#how-it-works" },
  { name: "About", href: "#about" },
  { name: "FAQ", href: "#faq" },
  { name: "Contact", href: "#contact" },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed left-1/2 -translate-x-1/2 w-[94%] max-w-[1200px] z-[1000] backdrop-blur-lg border border-gray-200 rounded-[100px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-center ${
          scrolled
            ? "top-4 bg-white/95 py-2 px-5 shadow-lg"
            : "top-6 bg-white/80 py-3 px-7 shadow-sm"
        }`}
      >
        <div className="flex justify-between items-center w-full gap-6">
          <a href="/" className="flex items-center gap-3 shrink-0 no-underline">
            <div className="w-9 h-9 bg-accent flex items-center justify-center text-white rounded-xl shadow-sm">
              <Truck size={18} strokeWidth={2.5} />
            </div>
            <div
              className="text-[1.15rem] font-bold tracking-tight text-[--color-text-primary] hidden md:block"
              style={{ fontFamily: "var(--font-roboto)" }}
            >
              iPrime
            </div>
          </a>

          <nav className="hidden lg:flex gap-8" aria-label="Primary">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-[0.875rem] font-semibold text-gray-500 hover:text-[--color-text-primary] transition-colors duration-200 no-underline"
              >
                {link.name}
              </a>
            ))}
          </nav>

          <div className="flex gap-3 items-center shrink-0">
            <a
              href="#download"
              className="ui-btn ui-btn-primary !px-5 !py-2.5 !text-[0.85rem]"
            >
              Get the App
            </a>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden bg-gray-50 border border-gray-200 rounded-xl p-2 cursor-pointer text-[--color-text-primary] flex items-center justify-center hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 w-full h-screen bg-white z-[999] pt-28 px-8 pb-12 flex flex-col gap-12 lg:hidden"
          >
            <nav className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-3xl font-extrabold text-[--color-text-primary] no-underline tracking-tighter"
                >
                  {link.name}
                </a>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-4">
              <a
                href="#download"
                onClick={() => setIsMenuOpen(false)}
                className="ui-btn ui-btn-primary p-5 text-[1.1rem] font-extrabold rounded-2xl flex justify-center !w-full"
              >
                Get the App
                <ArrowRight size={22} className="ml-2" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
