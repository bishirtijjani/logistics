import Image from "next/image";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { APP_URL } from "../lib/links";

// The original hero, moved down and repurposed as a product showcase. The
// category grid up top is now the primary entry point; this section reinforces
// the pitch with the app preview and the breadth of what's inside.
export default function ProductShowcase() {
  return (
    <section className="ui-section bg-bg-secondary overflow-hidden">
      <div className="ui-container">
        <div className="grid lg:grid-cols-[1fr_1.25fr] gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <span className="ui-eyebrow">The app</span>
            <h2 className="text-3xl md:text-4xl xl:text-5xl font-black mb-6 tracking-tighter leading-[1.05] text-text-primary">
              Anything you need,{" "}
              <span className="text-accent">delivered to your door</span>{" "}
              across Katsina.
            </h2>

            <p className="text-lg text-gray-600 mb-8 leading-relaxed font-medium max-w-xl mx-auto lg:mx-0">
              Food, groceries, pharmacy and parcels — picked up by a nearby
              rider, tracked live to your door. With a wallet and bill payments
              built in for everything else.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center mb-10">
              <a href={APP_URL} className="ui-btn ui-btn-primary">
                Open the web app
                <ArrowUpRight size={18} strokeWidth={2.5} />
              </a>
              <a href="#how-it-works" className="ui-btn ui-btn-ghost">
                See how it works
              </a>
            </div>

            <ul className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-gray-500 list-none p-0">
              <li className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-accent" />
                Live rider tracking
              </li>
              <li className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-accent" />
                Wallet + bills built in
              </li>
              <li className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-accent" />
                Free to use
              </li>
            </ul>
          </div>

          <div
            className="relative flex justify-center items-center"
            aria-hidden="true"
          >
            <Image
              src="/images/mock-with-packages.png"
              alt="iPrime home screen showing wallet balance and category tiles"
              width={864}
              height={1222}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
