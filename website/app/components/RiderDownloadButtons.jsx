"use client";

import { useState } from "react";
import WaitlistModal from "./WaitlistModal";

export default function RiderDownloadButtons() {
  const [modal, setModal] = useState({ open: false, platform: "UNKNOWN" });
  const openWaitlist = (platform) => setModal({ open: true, platform });

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <button
          type="button"
          onClick={() => openWaitlist("IOS")}
          aria-label="Join the iPrime Rider iOS waitlist"
          className="inline-block transition-transform hover:-translate-y-0.5 bg-transparent border-0 p-0 cursor-pointer"
        >
          <img
            src="/images/ios-app-store-btn.svg"
            alt="Download on the App Store"
            width={150}
            height={50}
            className="h-[50px] w-auto"
          />
        </button>
        <button
          type="button"
          onClick={() => openWaitlist("ANDROID")}
          aria-label="Join the iPrime Rider Android waitlist"
          className="inline-block transition-transform hover:-translate-y-0.5 bg-transparent border-0 p-0 cursor-pointer"
        >
          <img
            src="/images/google-play-btn.svg"
            alt="Get it on Google Play"
            width={167}
            height={50}
            className="h-[50px] w-auto"
          />
        </button>
      </div>

      <p className="mt-3 text-xs text-white/50 font-semibold">
        Coming soon — tap a button to join the rider launch waitlist.
      </p>

      <WaitlistModal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        role="RIDER"
        platform={modal.platform}
        source="/riders"
      />
    </>
  );
}
