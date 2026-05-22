"use client";

import { Mail, Phone, MapPin, Send, ArrowRight } from "lucide-react";
import { useState } from "react";

const channels = [
  {
    Icon: Mail,
    label: "Email us",
    value: "hello@iprime.ng",
    href: "mailto:hello@iprime.ng",
  },
  {
    Icon: Phone,
    label: "Call or WhatsApp",
    value: "+234 800 000 0000",
    href: "tel:+2348000000000",
  },
  {
    Icon: MapPin,
    label: "Find us",
    value: "Katsina, Nigeria",
    href: "#",
  },
];

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setForm({ name: "", email: "", message: "" });
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <section className="ui-section bg-white" id="contact">
      <div className="ui-container">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
          <div>
            <span className="ui-eyebrow">Contact</span>
            <h2 className="ui-title mb-6">
              Talk to the team <br />
              <span className="text-accent">behind the app.</span>
            </h2>
            <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-10">
              Press, partnerships, merchant or rider onboarding, or just a
              question — drop us a note and a human will get back to you within
              one business day.
            </p>

            <ul className="space-y-4 list-none p-0">
              {channels.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-accent/40 hover:bg-accent-dim/40 transition-all no-underline group"
                  >
                    <span className="w-11 h-11 rounded-xl bg-accent-dim text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                      <c.Icon size={18} strokeWidth={2.25} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs font-extrabold uppercase tracking-widest text-gray-400">
                        {c.label}
                      </span>
                      <span className="block text-base font-extrabold tracking-tight text-text-primary">
                        {c.value}
                      </span>
                    </span>
                    <ArrowRight
                      size={18}
                      strokeWidth={2.5}
                      className="text-gray-300 group-hover:text-accent group-hover:translate-x-1 transition-all"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-bg-secondary border border-gray-200 rounded-3xl p-6 md:p-8 lg:p-10"
            aria-label="Contact form"
          >
            <h3 className="text-2xl font-extrabold tracking-tight text-text-primary mb-6">
              Send us a message
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2"
                >
                  Your name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Aisha Ibrahim"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2"
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2"
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  placeholder="Tell us a bit about what you need…"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="ui-btn ui-btn-primary w-full !rounded-xl"
              >
                {sent ? "Message sent — thank you!" : "Send message"}
                {!sent && <Send size={16} strokeWidth={2.5} />}
              </button>

              <p className="text-xs text-gray-400 font-semibold text-center">
                By submitting, you agree to be contacted about your enquiry.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
