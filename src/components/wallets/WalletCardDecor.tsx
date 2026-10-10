import { InteractiveGridPattern } from "@/components/ui/interactive-grid-pattern";
import { ShineBorder } from "@/components/ui/shine-border";
import { getWalletAuraColors } from "@/lib/provider-card-style";
import { cn } from "@/lib/utils";

type WalletCardDecorProps = {
  walletId: number;
  providerIconKey: string | null | undefined;
  walletType: string;
  /** Dark plastic surface (white text) vs. light surface. */
  dark: boolean;
  /** Corner glows; only meaningful on a branded surface. */
  glows?: boolean;
};

/**
 * Decorative layers shared by every wallet card face (Billeteras list, deck,
 * enlarged view and the Panel financiero carousel): corner glows, the
 * interactive grid and the shine border. Render as the first child of a
 * `relative isolate overflow-hidden` card shell.
 */
export const WalletCardDecor = ({
  walletId,
  providerIconKey,
  walletType,
  dark,
  glows = true,
}: WalletCardDecorProps) => {
  const auraColors = getWalletAuraColors(providerIconKey, walletType);
  return (
    <>
      {glows ? (
        <>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -left-8 -top-10 h-20 w-20 rounded-full blur-2xl",
              dark ? "bg-white/8" : "bg-white/70",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -right-8 -bottom-10 h-20 w-20 rounded-full blur-2xl",
              dark ? "bg-black/20" : "bg-black/5",
            )}
          />
        </>
      ) : null}
      <InteractiveGridPattern
        width={14}
        height={14}
        squares={[20, 14]}
        className="-z-10 border-0 [mask-image:linear-gradient(115deg,white_10%,transparent_85%)]"
        squaresClassName={
          dark ? "stroke-white/[0.08]" : "stroke-foreground/[0.08]"
        }
      />
      {auraColors ? (
        <ShineBorder
          shineColor={auraColors.shine}
          borderWidth={1.5}
          duration={11}
          style={{ animationDelay: `-${(walletId % 7) * 1.6}s` }}
        />
      ) : null}
    </>
  );
};
