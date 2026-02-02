import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import DemoPreview from "@/components/landing/DemoPreview";
import FeatureGrid from "@/components/landing/FeatureGrid";
import AgenticSection from "@/components/landing/AgenticSection";
import PricingSection from "@/components/landing/PricingSection";
import CtaSection from "@/components/landing/CtaSection";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <DemoPreview />
      <AgenticSection />
      <FeatureGrid />
      <PricingSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
