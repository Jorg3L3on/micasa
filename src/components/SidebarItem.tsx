'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

type SidebarItemProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  collapsed: boolean;
};

export default function SidebarItem({
  href,
  icon: Icon,
  label,
  isActive,
  collapsed,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: 'ghost' }),
        'w-full justify-start gap-3',
        isActive && 'bg-accent text-accent-foreground',
        collapsed && 'justify-center px-2',
        collapsed && 'group relative',
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
