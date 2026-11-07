"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Where does Logistics Platform deliver?",
    a: "We're rolling out deliveries city-by-city across . Wallet, airtime, data, and electricity payments work everywhere in Nigeria from day one.",
  },
  {
    q: "Can I track my delivery rider live?",
    a: "Yes. As soon as a rider accepts your order, you'll see them on a map updating every few seconds, with an ETA that adjusts in real time as they move.",
  },
  {
    q: "How do I become a merchant or rider?",
    a: "Tap the Contact section below and tell us a bit about your business or where you ride. We'll get back to you with onboarding steps and what's needed to go live.",
  },
  {
    q: "How do I fund my wallet?",
    a: "Every account comes with its own virtual bank account number. Transfer to it from any Nigerian bank app and your wallet is credited within seconds. You can also withdraw your balance back to any bank account you own.",
  },
  {
    q: "Is my money safe?",
    a: "Yes. We use a regulated payment partner for wallet funding and withdrawals, every sensitive action requires your transaction PIN, and your balance is always reconciled against a full transaction ledger.",
  },
  {
    q: "What happens if an airtime or electricity purchase fails?",
    a: "If the network or DISCO doesn't deliver your top-up or token, our system automatically refunds the exact amount back to your wallet - no support ticket needed.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="ui-section bg-bg-secondary" id="faq">
      <div className="ui-container">
        <div className="flex flex-col lg:flex-row gap-16">
          <header className="lg:w-1/3">
            <span className="ui-eyebrow">FAQ</span>
            <h2 className="ui-title">
              Common <br className="hidden lg:block" /> questions.
            </h2>
            <p className="ui-sub">
              Everything you&apos;d want to know about the wallet, payments,
              and deliveries before you sign up.
            </p>
          </header>

          <div className="lg:w-2/3 space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={i}
                  className={`border rounded-2xl transition-colors duration-300 ${
                    isOpen
                      ? "border-accent bg-white shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="w-full p-6 text-left flex justify-between items-center group cursor-pointer gap-4"
                    aria-expanded={isOpen}
                  >
                    <span
                      className={`text-base md:text-lg font-extrabold tracking-tight transition-colors ${
                        isOpen
                          ? "text-text-primary"
                          : "text-gray-600 group-hover:text-text-primary"
                      }`}
                    >
                      {faq.q}
                    </span>
                    <span
                      className={`p-2 rounded-full transition-colors shrink-0 ${
                        isOpen
                          ? "bg-accent text-white"
                          : "bg-gray-50 text-gray-400 group-hover:bg-gray-100"
                      }`}
                    >
                      {isOpen ? (
                        <Minus size={16} strokeWidth={3} />
                      ) : (
                        <Plus size={16} strokeWidth={3} />
                      )}
                    </span>
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-6 pb-6 text-gray-500 leading-relaxed font-medium">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: f.a,
                },
              })),
            }),
          }}
        />
      </div>
    </section>
  );
}
