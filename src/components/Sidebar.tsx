'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderTree,
  CreditCard,
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  CalendarDays,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import SidebarItem from '@/components/SidebarItem';

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';

function getCurrentMonthHref(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `/monthly/${year}/${month}`;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navigation = [
    {
      title: 'Dashboard',
      items: [
        {
          title: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'Planificación',
      items: [
        {
          title: 'Control mensual',
          href: getCurrentMonthHref(),
          icon: Calendar,
        },
      ],
    },
    {
      title: 'Operaciones',
      items: [
        {
          title: 'Transacciones',
          href: '/transactions',
          icon: Receipt,
        },
      ],
    },
    {
      title: 'Catálogos',
      items: [
        {
          title: 'Plantillas de gastos',
          href: '/expense-templates',
          icon: Layers,
        },
        {
          title: 'Gastos',
          href: '/expenses',
          icon: FileText,
        },
        {
          title: 'Quincenas',
          href: '/fortnights',
          icon: CalendarDays,
        },
        {
          title: 'Categorías',
          href: '/categories',
          icon: FolderTree,
        },
        {
          title: 'Métodos de pago',
          href: '/payment-methods',
          icon: CreditCard,
        },
      ],
    },
  ];

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(JSON.parse(stored));
    }
  }, []);

  const toggleSidebar = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(newCollapsed));
  };

  return (
    <div
      className={`flex h-screen flex-col border-r bg-card transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && <h1 className="text-xl font-bold">MiCasa</h1>}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="ml-auto"
          aria-label={
            collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'
          }
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <nav className="space-y-6">
            {navigation.map((section) => (
              <div key={section.title}>
                {!collapsed && (
                  <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </h2>
                )}
                <div className="space-y-1">
                  {section.items.map((item, itemIndex) => {
                    const href = item.href;
                    const isActive =
                      pathname === href || pathname.startsWith(href + '/');
                    return (
                      <SidebarItem
                        key={`${section.title}-${item.title}-${itemIndex}`}
                        href={href}
                        icon={item.icon}
                        label={item.title}
                        isActive={isActive}
                        collapsed={collapsed}
                      />
                    );
                  })}
                </div>
                {!collapsed && <Separator className="my-4" />}
              </div>
            ))}
          </nav>
        </div>
      </ScrollArea>
    </div>
  );
}
