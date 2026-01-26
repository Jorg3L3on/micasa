"use client"

import * as React from "react"
import {
  LayoutDashboard,
  FolderTree,
  CreditCard,
  Receipt,
  Calendar,
  FileText,
  Layers,
  CalendarDays,
  Home,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { TeamSwitcher } from "@/components/team-switcher"
import { NavUser } from "@/components/nav-user"
import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

function getCurrentMonthHref(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `/monthly/${year}/${month}`
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  const navItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard" || pathname.startsWith("/dashboard/"),
    },
    {
      title: "Planificación",
      url: getCurrentMonthHref(),
      icon: Calendar,
      isActive: pathname.startsWith("/monthly/"),
    },
    {
      title: "Operaciones",
      url: "/transactions",
      icon: Receipt,
      isActive: pathname === "/transactions" || pathname.startsWith("/transactions/"),
    },
    {
      title: "Catálogos",
      url: "#",
      icon: FolderTree,
      isActive: pathname.startsWith("/expense-templates") ||
        pathname.startsWith("/expenses") ||
        pathname.startsWith("/fortnights") ||
        pathname.startsWith("/categories") ||
        pathname.startsWith("/payment-methods"),
      items: [
        {
          title: "Plantillas de gastos",
          url: "/expense-templates",
        },
        {
          title: "Gastos",
          url: "/expenses",
        },
        {
          title: "Quincenas",
          url: "/fortnights",
        },
        {
          title: "Categorías",
          url: "/categories",
        },
        {
          title: "Métodos de pago",
          url: "/payment-methods",
        },
      ],
    },
  ]

  const teams = [
    {
      name: "MiCasa",
      logo: Home,
      plan: "Gestión Financiera",
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: "Usuario",
            email: "usuario@ejemplo.com",
            avatar: "/avatars/user.jpg",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
