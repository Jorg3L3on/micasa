'use client';

import { useEffect } from 'react';
import { Receipt, TrendingUp, Wallet } from 'lucide-react';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';

const bullets = [
  {
    icon: Wallet,
    text: 'Dónde guardas tu dinero',
  },
  {
    icon: TrendingUp,
    text: 'Cómo registras ingresos',
  },
  {
    icon: Receipt,
    text: 'Cómo organizas tus gastos',
  },
] as const;

export default function StepWelcome() {
  const { setCanProceed } = useOnboarding();

  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground text-base leading-relaxed">
        MiCasa te ayuda a organizar tu dinero de forma clara y sencilla. En
        pocos pasos lo dejamos listo.
      </p>

      <ul className="flex flex-col gap-4" role="list">
        {bullets.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="text-foreground flex items-center gap-4"
            role="listitem"
          >
            <span
              className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg"
              aria-hidden
            >
              <Icon className="size-5" strokeWidth={2} />
            </span>
            <span className="text-sm font-medium">{text}</span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Esto tomará menos de un minuto.
      </p>
    </div>
  );
}
