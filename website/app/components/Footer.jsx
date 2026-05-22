import { Truck } from "lucide-react";

const TwitterIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const FacebookIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
  </svg>
);

const LinkedinIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.86-3.04-1.86 0-2.15 1.45-2.15 2.95v5.66H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.45v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .78 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .78 23.2 0 22.22 0z" />
  </svg>
);

const columns = [
  {
    title: "Product",
    links: [
      { name: "Features", href: "/#features" },
      { name: "How it works", href: "/#how-it-works" },
      { name: "Download", href: "/#download" },
      { name: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "/#about" },
      { name: "Contact", href: "/#contact" },
      { name: "Careers", href: "/careers" },
      { name: "Press", href: "/press" },
    ],
  },
  {
    title: "Partners",
    links: [
      { name: "For merchants", href: "/#contact" },
      { name: "For riders", href: "/#contact" },
      { name: "Bill payment partners", href: "/partners/bill-payment" },
      { name: "Bank partners", href: "/partners/banking" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy policy", href: "/legal/privacy" },
      { name: "Terms of service", href: "/legal/terms" },
      { name: "Refund policy", href: "/legal/refund" },
      { name: "Compliance", href: "/legal/compliance" },
    ],
  },
];

const socials = [
  { Icon: TwitterIcon, label: "Twitter" },
  { Icon: InstagramIcon, label: "Instagram" },
  { Icon: FacebookIcon, label: "Facebook" },
  { Icon: LinkedinIcon, label: "LinkedIn" },
];

export default function Footer() {
  return (
    <footer className="bg-text-primary text-white pt-20 pb-10">
      <div className="ui-container">
        <div className="grid lg:grid-cols-[1.4fr_repeat(4,1fr)] gap-12 lg:gap-10 pb-14 border-b border-white/10">
          <div>
            <a href="/" className="flex items-center gap-3 no-underline mb-5">
              <span className="w-10 h-10 bg-accent flex items-center justify-center text-white rounded-xl shadow-md shadow-accent/30">
                <Truck size={20} strokeWidth={2.5} />
              </span>
              <span
                className="text-lg font-bold tracking-tight text-white"
                style={{ fontFamily: "var(--font-roboto)" }}
              >
                iPrime
              </span>
            </a>
            <p className="text-sm text-white/50 font-medium leading-relaxed max-w-xs mb-6">
              The wallet, utilities, and delivery super-app for Katsina State.
              One login, one balance, one tracking history.
            </p>
            <div className="flex gap-2">
              {socials.map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-accent hover:border-accent hover:text-white transition-all"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-white/40 mb-4">
                {col.title}
              </div>
              <ul className="space-y-3 list-none p-0">
                {col.links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm font-semibold text-white/70 hover:text-white transition-colors no-underline"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8">
          <div className="text-xs text-white/40 font-semibold">
            © {new Date().getFullYear()} iPrime. Built in Katsina,
            Nigeria.
          </div>
          <div className="text-xs text-white/40 font-semibold flex items-center">
            All systems operational
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ml-2 animate-pulse"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
