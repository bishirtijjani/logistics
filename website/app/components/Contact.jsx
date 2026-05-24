"use client";

import {
  Mail,
  Phone,
  MapPin,
  Send,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { API_URL } from "../lib/api";
import Honeypot from "./Honeypot";

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
    value: "+234 906 561 7528",
    href: "tel:+2349065617528",
  },
  {
    Icon: MapPin,
    label: "Find us",
    value: "Katsina, Nigeria",
    href: "#",
  },
];

const initialForm = { name: "", email: "", message: "", website: "" };

export default function Contact() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const updateField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (fieldErrors[key]) {
      setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setErrorMsg("");
    setFieldErrors({});

    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
          website: form.website,
          source:
            typeof window !== "undefined"
              ? window.location.pathname
              : undefined,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        if (
          payload?.code === "VALIDATION_FAILED" &&
          Array.isArray(payload.errors)
        ) {
          const fe = {};
          payload.errors.forEach((err) => {
            if (err.field) fe[err.field] = err.message;
          });
          setFieldErrors(fe);
        }
        throw new Error(
          payload?.message || "Something went wrong. Please try again.",
        );
      }

      setStatus("success");
      setForm(initialForm);
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err.message ||
          "Network error. Please try again or email hello@iprime.ng.",
      );
    }
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
            noValidate
          >
            <h3 className="text-2xl font-extrabold tracking-tight text-text-primary mb-6">
              Send us a message
            </h3>

            {status === "success" ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-accent-dim text-accent flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={28} strokeWidth={2.25} />
                </div>
                <h4 className="text-xl font-black tracking-tight text-text-primary mb-2">
                  Message sent.
                </h4>
                <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
                  Thanks — we got it. A human will reply within one business
                  day.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus("idle")}
                  className="ui-btn ui-btn-ghost !rounded-xl"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <Honeypot
                  value={form.website}
                  onChange={updateField("website")}
                />
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
                    autoComplete="name"
                    value={form.name}
                    onChange={updateField("name")}
                    placeholder="Aisha Ibrahim"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
                  />
                  {fieldErrors.name && (
                    <p className="mt-1.5 text-xs font-semibold text-error">
                      {fieldErrors.name}
                    </p>
                  )}
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
                    autoComplete="email"
                    value={form.email}
                    onChange={updateField("email")}
                    placeholder="you@example.com"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
                  />
                  {fieldErrors.email && (
                    <p className="mt-1.5 text-xs font-semibold text-error">
                      {fieldErrors.email}
                    </p>
                  )}
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
                    onChange={updateField("message")}
                    placeholder="Tell us a bit about what you need…"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                  />
                  {fieldErrors.message && (
                    <p className="mt-1.5 text-xs font-semibold text-error">
                      {fieldErrors.message}
                    </p>
                  )}
                </div>

                {status === "error" && errorMsg && (
                  <p
                    role="alert"
                    className="text-sm font-semibold text-error bg-error/5 border border-error/30 rounded-xl px-3 py-2"
                  >
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="ui-btn ui-btn-primary w-full !rounded-xl disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send message
                      <Send size={16} strokeWidth={2.5} />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-400 font-semibold text-center">
                  By submitting, you agree to be contacted about your enquiry.
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
