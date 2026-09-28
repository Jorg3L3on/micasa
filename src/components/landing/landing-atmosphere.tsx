/**
 * Marketing-only wash. Orbs loop only when the user allows motion.
 * No pointer spotlight and no parallax.
 */
export const LandingAtmosphere = () => {
  return (
    <div aria-hidden className="landing-atmosphere pointer-events-none absolute inset-0 overflow-hidden">
      <div className="landing-orb landing-orb-a" />
      <div className="landing-orb landing-orb-b" />
      <div className="landing-orb landing-orb-c" />
    </div>
  );
};
