"use client";

import { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, Loader2 } from "lucide-react";
import { API_URL } from "../lib/api";

const COPY = {
  CUSTOMER: {
    eyebrow: "Customer waitlist",
    title: "The iPrime app isn't in the stores yet.",
    body: "Drop your details and we'll text you the moment it goes live in Katsina.",
  },
  RIDER: {
    eyebrow: "Rider waitlist",
    title: "The iPrime Rider app isn't in the stores yet.",
    body: "Leave your details and we'll be in touch as soon as onboarding opens for new riders.",
  },
  UNKNOWN: {
    eyebrow: "Join the waitlist",
    title: "The app isn't in the stores yet.",
    body: "Drop your details and we'll let you know the moment it launches.",
  },
};

const initialForm = { name: "", phone: "", email: "", city: "", notes: "" };

export default function WaitlistModal({
  open,
  onClose,
  role = "UNKNOWN",
  platform = "UNKNOWN",
  source,
}) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const firstFieldRef = useRef(null);

  const copy = COPY[role] || COPY.UNKNOWN;

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    // Focus the first input shortly after the modal mounts.
    const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      // Reset when modal is fully closed so the next open starts clean.
      const t = setTimeout(() => {
        setForm(initialForm);
        setStatus("idle");
        setErrorMsg("");
        setFieldErrors({});
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

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
      const res = await fetch(`${API_URL}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          city: form.city.trim() || undefined,
          notes: form.notes.trim() || undefined,
          role,
          platform,
          source:
            source ||
            (typeof window !== "undefined" ? window.location.pathname : undefined),
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        if (payload?.code === "VALIDATION_FAILED" && Array.isArray(payload.errors)) {
          const fe = {};
          payload.errors.forEach((err) => {
            if (err.field) fe[err.field] = err.message;
          });
          setFieldErrors(fe);
        }
        throw new Error(payload?.message || "Something went wrong. Please try again.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Network error. Please try again.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close waitlist form"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="px-6 sm:px-8 pt-8 pb-7">
          {status === "success" ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-accent-dim text-accent flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={28} strokeWidth={2.25} />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-text-primary mb-3">
                You&apos;re on the list.
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-6">
                We&apos;ll text {form.phone || "your number"} the moment the
                app goes live. Thanks for the patience.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="ui-btn ui-btn-primary w-full !rounded-xl"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <span className="ui-eyebrow">{copy.eyebrow}</span>
              <h3
                id="waitlist-modal-title"
                className="text-2xl font-black tracking-tight text-text-primary mb-3 leading-tight"
              >
                {copy.title}
              </h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
                {copy.body}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Field
                  id="waitlist-name"
                  label="Your name"
                  inputRef={firstFieldRef}
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Aisha Ibrahim"
                  value={form.name}
                  onChange={updateField("name")}
                  error={fieldErrors.name}
                />
                <Field
                  id="waitlist-phone"
                  label="Phone number"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0803 000 0000"
                  value={form.phone}
                  onChange={updateField("phone")}
                  error={fieldErrors.phone}
                />
                <Field
                  id="waitlist-email"
                  label="Email (optional)"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={updateField("email")}
                  error={fieldErrors.email}
                />
                <Field
                  id="waitlist-city"
                  label="City / area (optional)"
                  type="text"
                  autoComplete="address-level2"
                  placeholder="Katsina, Sabuwar Unguwa…"
                  value={form.city}
                  onChange={updateField("city")}
                  error={fieldErrors.city}
                />
                <div>
                  <label
                    htmlFor="waitlist-notes"
                    className="block text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2"
                  >
                    Anything else? (optional)
                  </label>
                  <textarea
                    id="waitlist-notes"
                    rows={3}
                    maxLength={1000}
                    placeholder="Tell us what you'd want from the app on day one…"
                    value={form.notes}
                    onChange={updateField("notes")}
                    className="w-full bg-bg-secondary border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                  />
                  {fieldErrors.notes && (
                    <p className="mt-1.5 text-xs font-semibold text-error">{fieldErrors.notes}</p>
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
                      Adding you…
                    </>
                  ) : (
                    "Join the waitlist"
                  )}
                </button>

                <p className="text-xs text-gray-400 font-semibold text-center">
                  We&apos;ll only use this to let you know when the app launches.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, error, inputRef, ...inputProps }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-2"
      >
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        {...inputProps}
        className="w-full bg-bg-secondary border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
      />
      {error && <p className="mt-1.5 text-xs font-semibold text-error">{error}</p>}
    </div>
  );
}
