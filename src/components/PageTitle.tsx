'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import Link from 'next/link';
import { useFinanceContext } from '@/context/finance-context';
import type { FinanceContextType } from '@/types/finance-context';

const buildOwnerSuffix = (context: FinanceContextType): string => {
  if (context.type === 'user' && context.id === 0) return '';
  return `?ownerType=${context.type}&ownerId=${context.id}`;
};

function getPageTitle(
  pathname: string,
  context: FinanceContextType,
): {
  title: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
} {
  const qs = buildOwnerSuffix(context);
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0 || segments[0] === 'dashboard') {
    return {
      title: 'Panel',
      breadcrumbs: [{ label: 'Panel' }],
    };
  }

  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: 'Inicio', href: `/dashboard${qs}` },
  ];

  // Handle expense-templates
  if (segments[0] === 'expense-templates') {
    breadcrumbs.push({
      label: 'Plantillas de gastos',
      href: `/expense-templates${qs}`,
    });
    if (segments[1] === 'new') {
      breadcrumbs.push({ label: 'Nueva plantilla' });
      return { title: 'Nueva plantilla', breadcrumbs };
    }
    if (segments[2] === 'edit') {
      breadcrumbs.push({ label: 'Editar' });
      return { title: 'Editar plantilla', breadcrumbs };
    }
    return { title: 'Plantillas de gastos', breadcrumbs };
  }

  // Handle income-templates
  if (segments[0] === 'income-templates') {
    breadcrumbs.push({
      label: 'Plantillas de ingresos',
      href: `/income-templates${qs}`,
    });
    if (segments[1] === 'new') {
      breadcrumbs.push({ label: 'Nueva plantilla' });
      return { title: 'Nueva plantilla', breadcrumbs };
    }
    if (segments[2] === 'edit') {
      breadcrumbs.push({ label: 'Editar' });
      return { title: 'Editar plantilla', breadcrumbs };
    }
    return { title: 'Plantillas de ingresos', breadcrumbs };
  }

  // Handle monthly pages
  if (segments[0] === 'monthly' && segments[1] && segments[2]) {
    const year = parseInt(segments[1], 10);
    const month = parseInt(segments[2], 10);
    const months = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const monthName = months[month - 1] || '';
    const title = `${monthName} ${year}`;
    breadcrumbs.push({ label: title });
    return { title, breadcrumbs };
  }

  // Handle fortnight pages
  if (
    segments[0] === 'fortnight' &&
    segments[1] &&
    segments[2] &&
    segments[3]
  ) {
    const year = parseInt(segments[1], 10);
    const month = parseInt(segments[2], 10);
    const period = segments[3].toUpperCase();
    const months = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const monthName = months[month - 1] || '';
    const periodLabel = period === 'FIRST' ? '1–15' : '16–31';
    const title = `${periodLabel} ${monthName} ${year}`;
    breadcrumbs.push({
      label: `${monthName} ${year}`,
      href: `/monthly/${year}/${segments[2]}${qs}`,
    });
    breadcrumbs.push({ label: periodLabel });
    return { title, breadcrumbs };
  }

  if (segments[0] === 'pantry') {
    if (segments[1] === 'shopping') {
      breadcrumbs.push({
        label: 'Lista de compras',
        href: `/pantry/shopping${qs}`,
      });
      if (segments[2] && /^\d+$/.test(segments[2])) {
        breadcrumbs.push({ label: `Lista #${segments[2]}` });
        return { title: 'Detalle de lista de compras', breadcrumbs };
      }
      return { title: 'Lista de compras', breadcrumbs };
    }
    if (segments[1] === 'receipts') {
      breadcrumbs.push({
        label: 'Recibos',
        href: `/pantry/receipts${qs}`,
      });
      if (segments[2] && /^\d+$/.test(segments[2])) {
        breadcrumbs.push({ label: `Recibo #${segments[2]}` });
        return { title: 'Detalle del recibo', breadcrumbs };
      }
      return { title: 'Recibos', breadcrumbs };
    }
    if (segments[1] === 'products') {
      breadcrumbs.push({
        label: 'Productos',
        href: `/pantry/products${qs}`,
      });
      return { title: 'Productos de despensa', breadcrumbs };
    }
    return { title: 'Despensa', breadcrumbs };
  }

  if (segments[0] === 'wallets') {
    breadcrumbs.push({ label: 'Billeteras', href: `/wallets${qs}` });
    if (segments[1] === 'liquidity') {
      breadcrumbs.push({ label: 'Proyección de liquidez' });
      return { title: 'Proyección de liquidez', breadcrumbs };
    }
    return { title: 'Billeteras', breadcrumbs };
  }

  if (segments[0] === 'credit-cards') {
    breadcrumbs.push({ label: 'Billeteras', href: `/wallets${qs}` });
    breadcrumbs.push({ label: 'Estado de cuenta' });
    return { title: 'Estado de cuenta', breadcrumbs };
  }

  if (segments[0] === 'budgets') {
    breadcrumbs.push({ label: 'Presupuestos' });
    return { title: 'Presupuestos', breadcrumbs };
  }

  if (segments[0] === 'transactions') {
    breadcrumbs.push({ label: 'Operaciones' });
    return { title: 'Operaciones', breadcrumbs };
  }

  if (segments[0] === 'house-users') {
    breadcrumbs.push({ label: 'Usuarios de la casa' });
    return { title: 'Usuarios de la casa', breadcrumbs };
  }

  if (segments[0] === 'tasks') {
    breadcrumbs.push({ label: 'Tareas', href: `/tasks${qs}` });

    if (!segments[1]) {
      return { title: 'Tareas', breadcrumbs };
    }

    if (segments[1] === 'todo-lists') {
      breadcrumbs.push({ label: 'Listas de tareas' });
      return { title: 'Listas de tareas', breadcrumbs };
    }

    if (segments[1] === 'scheduled') {
      breadcrumbs.push({ label: 'Tareas programadas' });
      return { title: 'Tareas programadas', breadcrumbs };
    }

    if (segments[1] === 'habits') {
      breadcrumbs.push({ label: 'Hábitos' });
      return { title: 'Hábitos', breadcrumbs };
    }

    if (segments[1] === 'routines') {
      breadcrumbs.push({ label: 'Rutinas diarias' });
      return { title: 'Rutinas diarias', breadcrumbs };
    }

    if (segments[1] === 'lists' && segments[2] && /^\d+$/.test(segments[2])) {
      breadcrumbs.push({ label: 'Listas de tareas', href: `/tasks/todo-lists${qs}` });
      breadcrumbs.push({ label: `Lista #${segments[2]}` });
      return { title: `Lista #${segments[2]}`, breadcrumbs };
    }

    return { title: 'Tareas', breadcrumbs };
  }

  // Handle other pages
  const pageTitles: Record<string, string> = {
    account: 'Cuenta',
    categories: 'Categorías',
    pantry: 'Despensa',
    expenses: 'Gastos',
  };

  const pageTitle = pageTitles[segments[0]] || segments[0];
  breadcrumbs.push({ label: pageTitle });
  return { title: pageTitle, breadcrumbs };
}

export default function PageTitle() {
  const pathname = usePathname();
  const { context } = useFinanceContext();
  const { breadcrumbs } = getPageTitle(pathname, context);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
