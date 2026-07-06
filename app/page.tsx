import { Nav } from "./_landing/Nav";
import { Hero } from "./_landing/Hero";
import {
  SocialProof,
  StatsSection,
  Features,
  HowItWorksSection,
  Demo,
  Testimonials,
} from "./_landing/Sections";
import { Pricing } from "./_landing/Pricing";
import { Faq, FinalCta, Footer } from "./_landing/Closing";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Nav />
      <Hero />
      <SocialProof />
      <StatsSection />
      <Features />
      <HowItWorksSection />
      <Demo />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}
