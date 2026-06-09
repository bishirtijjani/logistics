import { Inter, Roboto } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://iprime.ng"),
  title: {
    default: "iPrime - Delivery, Wallet & Bills for Katsina",
    template: "%s · iPrime",
  },
  description:
    "iPrime is Katsina's delivery app. Order food, groceries, pharmacy and parcels with live rider tracking - plus a built-in wallet that handles airtime, data and electricity bills.",
  keywords: [
    "iPrime",
    "Katsina delivery",
    "Nigeria wallet app",
    "airtime data Nigeria",
    "electricity bill payment",
    "food delivery Katsina",
    "package delivery Nigeria",
    "courier Katsina",
    "super-app Nigeria",
  ],
  authors: [{ name: "iPrime" }],
  creator: "iPrime",
  publisher: "iPrime",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://iprime.ng",
    title: "iPrime - Delivery, Wallet & Bills for Katsina",
    description:
      "Door-to-door delivery across Katsina State - food, groceries, pharmacy and parcels, with a built-in wallet and bill payments.",
    siteName: "iPrime",
  },
  twitter: {
    card: "summary_large_image",
    title: "iPrime - Delivery, Wallet & Bills for Katsina",
    description:
      "Door-to-door delivery across Katsina State - food, groceries, pharmacy and parcels, with a built-in wallet and bill payments.",
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
    <html lang="en" className={`${inter.variable} ${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-text-primary">
        {children}
      </body>
    </html>
  );
}
