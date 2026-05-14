import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://vtulogistics.com"),
  title: {
    default: "VTU Logistics — Wallet, Utilities & Delivery in Katsina",
    template: "%s · VTU Logistics",
  },
  description:
    "VTU Logistics is the wallet, utilities, and delivery super-app for Katsina State. Send money, pay bills, order food, groceries, pharmacy and courier — all in one app.",
  keywords: [
    "VTU Logistics",
    "Katsina delivery",
    "Nigeria wallet app",
    "airtime data Nigeria",
    "electricity bill payment",
    "food delivery Katsina",
    "package delivery Nigeria",
    "courier Katsina",
    "super-app Nigeria",
  ],
  authors: [{ name: "VTU Logistics" }],
  creator: "VTU Logistics",
  publisher: "VTU Logistics",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://vtulogistics.com",
    title: "VTU Logistics — Wallet, Utilities & Delivery in Katsina",
    description:
      "One app for your wallet, airtime, electricity, and door-to-door delivery across Katsina State.",
    siteName: "VTU Logistics",
  },
  twitter: {
    card: "summary_large_image",
    title: "VTU Logistics — Wallet, Utilities & Delivery in Katsina",
    description:
      "One app for your wallet, airtime, electricity, and door-to-door delivery across Katsina State.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  themeColor: "#EA580C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-[--color-text-primary]">
        {children}
      </body>
    </html>
  );
}
