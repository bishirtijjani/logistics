import Header from "./components/Header";
import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Audience from "./components/Audience";
import About from "./components/About";
import Download from "./components/Download";
import FAQ from "./components/FAQ";
import Contact from "./components/Contact";
import Social from "./components/Social";
import Footer from "./components/Footer";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "iPrime",
  url: "https://vtulogistics.com",
  logo: "https://vtulogistics.com/favicon.ico",
  description:
    "Wallet, utilities, and delivery super-app for Katsina State, Nigeria.",
  address: {
    "@type": "PostalAddress",
    addressRegion: "Katsina",
    addressCountry: "NG",
  },
  contactPoint: {
    "@type": "ContactPoint",
    email: "hello@vtulogistics.com",
    contactType: "customer support",
    areaServed: "NG",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Audience />
        <About />
        <Download />
        <FAQ />
        <Contact />
        <Social />
      </main>
      <Footer />
    </>
  );
}
