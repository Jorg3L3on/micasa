'use client';

/**
 * Extension points of the wizard shell. Both render nothing for now; they are
 * rendered inside `OnboardingProvider`, so they can read `useOnboarding()`.
 *
 * - `OnboardingAsidePreviewSlot`: bottom of the desktop aside (≥781px), under
 *   the stepper. Phase 3 renders the live "Tu quincena hasta ahora" card here.
 * - `OnboardingPhoneStripSlot`: phones only (<781px), directly above the footer
 *   buttons. Phase 3 renders the "Libre en la 1ª / 2ª" strip here.
 *
 * The wizard hides each wrapper while its slot is empty.
 */

export const OnboardingAsidePreviewSlot = () => null;

export const OnboardingPhoneStripSlot = () => null;
