import { Fragment } from "react";

const steps = [
  {
    num: "01",
    headline: "You place the order",
    line: "Open iPrime, pick what you need, and pay from your wallet.",
    Illustration: TapIllustration,
  },
  {
    num: "02",
    headline: "The shop prepares it",
    line: "Your local shop or kitchen is notified and starts preparing your order.",
    Illustration: ShopIllustration,
  },
  {
    num: "03",
    headline: "A rider picks it up",
    line: "A nearby rider accepts the job. You can follow them on the map in real time.",
    Illustration: RiderIllustration,
  },
  {
    num: "04",
    headline: "It arrives at your door",
    line: "The rider hands it over. Your wallet settles the merchant and the rider automatically.",
    Illustration: DoorIllustration,
  },
];

function TapIllustration() {
  return (
    <svg
      viewBox="0 0 160 180"
      fill="none"
      aria-hidden="true"
      className="h-full w-auto"
    >
      {/* Phone body */}
      <rect
        x="46"
        y="32"
        width="68"
        height="116"
        rx="12"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        fill="#fff"
      />
      {/* Screen */}
      <rect
        x="54"
        y="42"
        width="52"
        height="96"
        rx="4"
        fill="var(--color-accent-dim)"
      />
      {/* Notch */}
      <rect x="73" y="36" width="14" height="3" rx="1.5" fill="currentColor" />
      {/* Top label */}
      <rect x="63" y="56" width="34" height="6" rx="2" fill="currentColor" opacity="0.18" />
      <rect x="63" y="68" width="22" height="4" rx="2" fill="currentColor" opacity="0.12" />
      {/* ORDER button */}
      <rect x="63" y="84" width="34" height="22" rx="4" fill="var(--color-accent)" />
      <text x="80" y="100" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800" fontFamily="ui-monospace, monospace">ORDER</text>
      {/* Tap ripple */}
      <circle
        cx="100"
        cy="118"
        r="10"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        opacity="0.6"
        strokeDasharray="2 3"
      />
      <circle
        cx="100"
        cy="118"
        r="18"
        stroke="var(--color-accent)"
        strokeWidth="2"
        opacity="0.3"
        strokeDasharray="2 4"
      />
    </svg>
  );
}

function ShopIllustration() {
  return (
    <svg
      viewBox="0 0 180 180"
      fill="none"
      aria-hidden="true"
      className="h-full w-auto"
    >
      {/* Awning shadow line */}
      <line x1="22" y1="62" x2="158" y2="62" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      {/* Scalloped orange awning */}
      <path
        d="M22 38 L158 38 L158 56 Q148 64 138 56 Q128 64 118 56 Q108 64 98 56 Q88 64 78 56 Q68 64 58 56 Q48 64 38 56 Q28 64 22 56 Z"
        fill="var(--color-accent)"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Awning stripes */}
      <line x1="40" y1="38" x2="40" y2="56" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      <line x1="60" y1="38" x2="60" y2="56" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      <line x1="80" y1="38" x2="80" y2="56" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      <line x1="100" y1="38" x2="100" y2="56" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      <line x1="120" y1="38" x2="120" y2="56" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      <line x1="140" y1="38" x2="140" y2="56" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      {/* Sign panel above awning */}
      <rect x="56" y="20" width="68" height="16" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <text x="90" y="32" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="900" fontFamily="ui-monospace, monospace">SHOP</text>
      {/* Building walls */}
      <path
        d="M26 64 L26 156 L154 156 L154 64"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        fill="var(--color-bg-secondary)"
      />
      {/* Floor line */}
      <line x1="14" y1="158" x2="166" y2="158" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      {/* Door */}
      <rect x="76" y="100" width="28" height="56" rx="2" stroke="currentColor" strokeWidth="3" fill="#fff" />
      <circle cx="98" cy="128" r="1.8" fill="currentColor" />
      {/* Left window with goods */}
      <rect x="36" y="78" width="32" height="28" rx="2" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <rect x="40" y="94" width="6" height="10" rx="1" fill="var(--color-accent)" opacity="0.7" />
      <rect x="49" y="92" width="6" height="12" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="58" y="96" width="6" height="8" rx="1" fill="var(--color-accent)" opacity="0.5" />
      <line x1="36" y1="92" x2="68" y2="92" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      {/* Right window with goods */}
      <rect x="112" y="78" width="32" height="28" rx="2" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="120" cy="98" r="4" fill="var(--color-accent)" opacity="0.6" />
      <circle cx="130" cy="98" r="4" fill="currentColor" opacity="0.35" />
      <circle cx="140" cy="98" r="4" fill="var(--color-accent)" opacity="0.5" />
      <line x1="112" y1="92" x2="144" y2="92" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      {/* OPEN sign on door */}
      <rect x="80" y="108" width="20" height="8" rx="1.5" fill="var(--color-accent)" />
      <text x="90" y="114.5" textAnchor="middle" fill="#fff" fontSize="5.5" fontWeight="900" fontFamily="ui-monospace, monospace">OPEN</text>
    </svg>
  );
}

function RiderIllustration() {
  return (
    <svg
      viewBox="-70 30 540 410"
      fill="none"
      aria-hidden="true"
      className="h-full w-auto text-text-primary"
    >
      {/* Motion lines on the left */}
      <line x1="-65" y1="200" x2="-15" y2="200" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
      <line x1="-70" y1="250" x2="-10" y2="250" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.45" />
      <line x1="-60" y1="300" x2="-25" y2="300" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
      <line x1="-65" y1="350" x2="-30" y2="350" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.2" />

      {/* Delivery bike (paths from /public/delivery-bike.svg) */}
      <g fill="currentColor">
        <path d="M96.582,228.085c-43.026,0-78.03,35.004-78.03,78.029c0,43.023,35.004,78.025,78.03,78.025h0.002 c43.024,0,78.027-35.002,78.027-78.025C174.611,263.089,139.607,228.085,96.582,228.085z M96.584,370.14h-0.002 c-35.306,0-64.03-28.722-64.03-64.025c0-35.306,28.724-64.029,64.03-64.029c35.306,0,64.029,28.724,64.029,64.029 C160.611,341.418,131.889,370.14,96.584,370.14z" />
        <path d="M96.58,281.802c-13.406,0-24.313,10.907-24.313,24.314c0,13.402,10.907,24.307,24.313,24.307 c13.406,0,24.313-10.904,24.313-24.307C120.893,292.709,109.986,281.802,96.58,281.802z" />
        <path d="M378.453,228.085c-9.499,0-18.604,1.711-27.03,4.833l-23.453-50.632c3.429,2.024,7.422,3.191,11.684,3.191 c3.866,0,7-3.134,7-7V146.35c0-3.866-3.134-7-7-7c-11.371,0-20.839,8.273-22.719,19.114l-16.609-35.857 c-1.147-2.474-3.625-4.058-6.352-4.058h-20.88c-3.866,0-7,3.134-7,7s3.134,7,7,7h16.408l10.1,21.804 c-0.296,0.329-0.566,0.688-0.803,1.082l-67.106,111.859h-8.423c-2.661,0-4.826-2.165-4.826-4.825v-49.828 c0-20.756-16.886-37.643-37.641-37.643h-54.111V79.343c0-3.866-3.134-7-7-7H7c-3.866,0-7,3.134-7,7v128.843c0,3.866,3.134,7,7,7 h37.324c-15.788,9.073-29.238,22.222-38.63,38.459c-1.936,3.347-0.792,7.628,2.554,9.564c3.345,1.935,7.628,0.793,9.564-2.555 c16.224-28.046,46.407-45.469,78.77-45.469c50.139,0,90.93,40.791,90.93,90.931c0,3.866,3.134,7,7,7h72.557 c2.464,0,4.746-1.295,6.009-3.41l55.475-92.854l10.238,22.104c-22.943,13.602-38.367,38.607-38.367,67.159 c0,43.023,35.004,78.025,78.03,78.025h0.002c43.024,0,78.027-35.002,78.027-78.025 C456.482,263.089,421.479,228.085,378.453,228.085z M14,174.999v-58.703h98.692v58.703H93.88H14z M112.692,86.343v15.953H14V86.343 H112.692z M320.62,202.833l-57.523,96.283h-61.824c-3.615-54.607-49.185-97.931-104.69-97.931c-0.853,0-82.582,0-82.582,0v-12.187 h166.804c13.036,0,23.641,10.607,23.641,23.643v49.828c0,10.38,8.445,18.825,18.826,18.825h12.387c2.459,0,4.737-1.29,6.003-3.399 l64.988-108.33l14.861,32.084C321.18,202.006,320.879,202.399,320.62,202.833z M378.455,370.14h-0.002 c-35.307,0-64.03-28.722-64.03-64.025c0-22.929,12.121-43.07,30.286-54.383l17.025,36.756c-4.672,4.434-7.595,10.693-7.595,17.628 c0,13.402,10.906,24.307,24.313,24.307c13.405,0,24.312-10.904,24.312-24.307c0-13.406-10.906-24.314-24.312-24.314 c-1.438,0-2.844,0.133-4.213,0.373l-16.904-36.494c6.616-2.319,13.72-3.596,21.118-3.596c35.306,0,64.029,28.724,64.029,64.029 C442.482,341.418,413.76,370.14,378.455,370.14z" />
      </g>

      {/* Orange iPrime overlay on the delivery box */}
      <rect x="14" y="116.3" width="98.7" height="58.7" fill="var(--color-accent)" />
      <line x1="14" y1="135" x2="112.7" y2="135" stroke="#fff" strokeWidth="1.5" opacity="0.45" />
      <text
        x="63.3"
        y="160"
        textAnchor="middle"
        fill="#fff"
        fontSize="24"
        fontWeight="900"
        fontFamily="ui-monospace, monospace"
      >
        iPrime
      </text>

      {/* Road */}
      <line
        x1="-70"
        y1="415"
        x2="470"
        y2="415"
        stroke="currentColor"
        strokeWidth="5"
        strokeDasharray="14 18"
        opacity="0.5"
      />
    </svg>
  );
}

function DoorIllustration() {
  return (
    <svg
      viewBox="0 0 160 180"
      fill="none"
      aria-hidden="true"
      className="h-full w-auto"
    >
      <path
        d="M40 38 L40 148 L120 148 L120 38 Q120 32 114 32 L46 32 Q40 32 40 38 Z"
        stroke="currentColor"
        strokeWidth="3.5"
        fill="var(--color-bg-secondary)"
        strokeLinejoin="round"
      />
      <rect x="50" y="46" width="60" height="68" rx="2" fill="currentColor" opacity="0.08" />
      <circle cx="108" cy="92" r="3.5" fill="currentColor" />
      <line x1="28" y1="156" x2="132" y2="156" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M68 122 L66 144 L94 144 L92 122 Z"
        fill="var(--color-accent)"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M72 122 Q80 113 88 122"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <text x="80" y="138" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="900" fontFamily="ui-monospace, monospace">iPrime</text>
      <path
        d="M100 100 L108 92 L106 96 L112 96 L104 104 L106 100 Z"
        fill="var(--color-accent)"
        opacity="0.7"
      />
      <line x1="22" y1="20" x2="28" y2="14" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="20" y1="28" x2="16" y2="22" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="30" y1="28" x2="36" y2="22" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Squiggle({ vertical = false }) {
  if (vertical) {
    return (
      <svg
        viewBox="0 0 40 80"
        aria-hidden="true"
        className="w-10 h-20 mx-auto text-accent"
        fill="none"
      >
        <path
          d="M20 4 Q34 18 20 32 Q6 46 20 60"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="4 5"
        />
        <path
          d="M12 60 L20 72 L28 60"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 80 32"
      aria-hidden="true"
      className="w-full h-8 text-accent"
      fill="none"
    >
      <path
        d="M4 16 Q20 4 38 16 Q56 28 68 16"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="4 5"
      />
      <path
        d="M62 8 L74 16 L62 24"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function HowItWorks() {
  return (
    <section
      className="ui-section bg-bg-secondary overflow-hidden"
      id="how-it-works"
    >
      <div className="ui-container">
        <header className="max-w-2xl mb-16 md:mb-20">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.32em] text-accent mb-4 block">
            How it works
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] text-text-primary">
            What happens when you{" "}
            <span className="text-accent">place an order.</span>
          </h2>
        </header>

        {/* Desktop: horizontal row with squiggles between */}
        <div className="hidden md:grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-x-2 lg:gap-x-4">
          {steps.map((s, i) => (
            <Fragment key={s.num}>
              <div className="text-text-primary flex flex-col">
                <div className="mb-6 h-44 lg:h-48 mx-auto flex items-end justify-center">
                  <s.Illustration />
                </div>
                <div className="text-center">
                  <div className="font-mono text-3xl lg:text-4xl font-black text-accent tracking-tighter leading-none mb-3">
                    {s.num}
                  </div>
                  <h3 className="text-xl lg:text-2xl font-black tracking-tight mb-3 min-h-14 lg:min-h-16">
                    {s.headline}
                  </h3>
                  <p className="text-sm lg:text-[15px] text-gray-600 font-medium leading-relaxed max-w-[18ch] mx-auto min-h-20">
                    {s.line}
                  </p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="w-full max-w-20 mt-16 lg:mt-20">
                  <Squiggle />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* Mobile: vertical stack with vertical squiggle between */}
        <div className="md:hidden flex flex-col items-center">
          {steps.map((s, i) => (
            <div key={s.num} className="w-full">
              <div className="text-text-primary flex flex-col items-center text-center">
                <div className="mb-4 w-40">
                  <s.Illustration />
                </div>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-mono text-4xl font-black text-accent tracking-tighter leading-none">
                    {s.num}
                  </span>
                  <h3 className="text-2xl font-black tracking-tight">
                    {s.headline}
                  </h3>
                </div>
                <p className="text-[15px] text-gray-600 font-medium leading-relaxed max-w-[24ch]">
                  {s.line}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className="py-4">
                  <Squiggle vertical />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
