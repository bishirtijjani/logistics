import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pb-16 md:pb-24 overflow-hidden pt-18 bg-bg-secondary">
      <div className="ui-container">
        <div className="grid lg:grid-cols-[1fr_1.25fr] gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl xl:text-[3.75rem] font-black mb-6 tracking-tighter leading-[1.02] text-text-primary">
              Anything you need,{" "}
              <span className="text-accent">delivered to your door</span>{" "}
              <br className="hidden md:block" />
              across Katsina.
            </h1>

            <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed font-medium max-w-xl mx-auto lg:mx-0">
              Food, groceries, pharmacy and parcels — picked up by a nearby
              rider, tracked live to your door. With a wallet and bill payments
              built in for everything else.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center mb-10">
              <a href="#download" className="ui-btn ui-btn-primary">
                Download the App
                <ArrowRight size={18} strokeWidth={2.5} />
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
                Free to download
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
              priority
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
