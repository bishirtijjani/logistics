import { ArrowUpRight } from "lucide-react";

const TwitterIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
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
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
  </svg>
);

const LinkedinIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.86-3.04-1.86 0-2.15 1.45-2.15 2.95v5.66H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.45v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .78 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .78 23.2 0 22.22 0z" />
  </svg>
);

const TikTokIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const channels = [
  {
    Icon: InstagramIcon,
    name: "Instagram",
    handle: "@",
    href: "#",
    accent: "from-fuchsia-500 to-amber-500",
  },
  {
    Icon: TikTokIcon,
    name: "TikTok",
    handle: "@",
    href: "#",
    accent: "from-cyan-400 to-rose-500",
  },
  {
    Icon: TwitterIcon,
    name: "X / Twitter",
    handle: "@logistics_app",
    href: "#",
    accent: "from-zinc-700 to-zinc-900",
  },
  {
    Icon: FacebookIcon,
    name: "Facebook",
    handle: "Logistics Platform Katsina",
    href: "#",
    accent: "from-blue-500 to-blue-700",
  },
  {
    Icon: LinkedinIcon,
    name: "LinkedIn",
    handle: "Logistics Platform",
    href: "#",
    accent: "from-sky-600 to-sky-800",
  },
];

export default function Social() {
  return (
    <section className="ui-section bg-bg-secondary" id="socials">
      <div className="ui-container">
        <header className="text-center max-w-2xl mx-auto mb-12">
          <span className="ui-eyebrow">Stay in the loop</span>
          <h2 className="ui-title">
            Catch the latest on{" "}
            <span className="text-accent">our timeline.</span>
          </h2>
          <p className="ui-sub mx-auto">
            New restaurants, route launches, rider stories, and the occasional
            jollof debate. Follow whichever app you actually open.
          </p>
        </header>

        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 list-none p-0">
          {channels.map(({ Icon, name, handle, href, accent }) => (
            <li key={name}>
              <a
                href={href}
                aria-label={`Follow Logistics Platform on ${name}`}
                className="group relative flex flex-col bg-white border border-gray-200 rounded-2xl p-5 hover:border-accent/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden no-underline h-full"
              >
                <div
                  aria-hidden="true"
                  className={`absolute -top-12 -right-12 w-28 h-28 rounded-full bg-linear-to-br ${accent} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500`}
                />

                <div className="flex items-start justify-between mb-5 relative">
                  <div
                    className={`w-11 h-11 rounded-xl bg-linear-to-br ${accent} text-white flex items-center justify-center shadow-md`}
                  >
                    <Icon width="18" height="18" />
                  </div>
                  <ArrowUpRight
                    size={18}
                    strokeWidth={2.5}
                    className="text-gray-300 group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all"
                  />
                </div>

                <div className="relative">
                  <div className="text-[0.7rem] font-extrabold uppercase tracking-widest text-gray-400 mb-1">
                    {name}
                  </div>
                  <div className="text-base font-extrabold tracking-tight text-text-primary">
                    {handle}
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
