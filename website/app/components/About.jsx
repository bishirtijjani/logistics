import { MapPin, Users, Bike, Store } from "lucide-react";

const stats = [
  { Icon: MapPin, value: "Katsina", label: "State coverage" },
  { Icon: Store, value: "Local", label: "Merchant partners" },
  { Icon: Bike, value: "Riders", label: "Earning on the platform" },
  { Icon: Users, value: "One app", label: "For every daily errand" },
];

export default function About() {
  return (
    <section className="ui-section bg-white" id="about">
      <div className="ui-container">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="relative rounded-3xl bg-accent-dim p-8 md:p-10 border border-accent-soft">
              <div className="grid grid-cols-2 gap-4">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="bg-white border border-gray-200 rounded-2xl p-5"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center mb-3">
                      <s.Icon size={16} strokeWidth={2.5} />
                    </div>
                    <div className="text-xl font-black tracking-tight text-text-primary">
                      {s.value}
                    </div>
                    <div className="text-xs text-gray-500 font-semibold mt-0.5">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="ui-eyebrow">About iPrime</span>
            <h2 className="ui-title mb-6">
              Built in Katsina, <br />
              <span className="text-accent">for Katsina.</span>
            </h2>
            <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-5">
              iPrime is a homegrown delivery platform for the people of
              Katsina State — connecting local restaurants, supermarkets,
              pharmacies, and independent riders to the doors that need them.
            </p>
            <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed mb-8">
              A built-in wallet pays for every order, and the same balance
              covers your airtime, data, and electricity bills — so you never
              juggle apps to pay for what you ordered.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border-l-2 border-accent pl-4">
                <div className="text-sm font-extrabold tracking-tight text-text-primary mb-1">
                  For customers
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  One wallet, every service, real-time tracking.
                </div>
              </div>
              <div className="border-l-2 border-accent pl-4">
                <div className="text-sm font-extrabold tracking-tight text-text-primary mb-1">
                  For merchants &amp; riders
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  More orders, instant settlements, less paperwork.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
