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

function getPageTitle(pathname: string): {
  title: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
} {
  // Remove leading slash and split path
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0 || segments[0] === 'dashboard') {
    return {
      title: 'Dashboard',
      breadcrumbs: [{ label: 'Dashboard' }],
    };
  }

  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: 'Inicio', href: '/dashboard' },
  ];

  // Handle expense-templates
  if (segments[0] === 'expense-templates') {
    breadcrumbs.push({
      label: 'Plantillas de gastos',
      href: '/expense-templates',
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
      href: `/monthly/${year}/${segments[2]}`,
    });
    breadcrumbs.push({ label: periodLabel });
    return { title, breadcrumbs };
  }

  // Handle other pages
  const pageTitles: Record<string, string> = {
    account: 'Cuenta',
    categories: 'Categorías',
    expenses: 'Gastos',
    fortnights: 'Quincenas',
    transactions: 'Transacciones',
    wallets: 'Carteras',
  };

  const pageTitle = pageTitles[segments[0]] || segments[0];
  breadcrumbs.push({ label: pageTitle });
  return { title: pageTitle, breadcrumbs };
}

export default function PageTitle() {
  const pathname = usePathname();
  const { title, breadcrumbs } = getPageTitle(pathname);

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
