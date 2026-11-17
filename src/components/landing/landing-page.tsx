import './landing.css';

import { LandingHeader } from '@/components/landing/landing-header';
import { LandingHero } from '@/components/landing/landing-hero';
import {
  CasaSection,
  ClosingSection,
  FaqSection,
  LandingFooter,
  ProductSection,
  QuincenaSection,
  StepsSection,
  WordBand,
} from '@/components/landing/landing-sections';

/**
 * Public landing. Dark only: `dark` on the root forces the Orion dark tokens
 * whatever theme the visitor uses inside the app.
 */
export const LandingPage = () => {
  return (
    <div className="landing-root mc-root dark">
      <a href="#contenido" className="mc-skip">
        Saltar al contenido
      </a>
      <LandingHeader />
      <main id="contenido">
        <LandingHero />
        <WordBand />
        <QuincenaSection />
        <ProductSection />
        <CasaSection />
        <StepsSection />
        <FaqSection />
        <ClosingSection />
      </main>
      <LandingFooter />
    </div>
  );
};
