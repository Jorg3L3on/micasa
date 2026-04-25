"use client"

import { Suspense } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { useClientMounted } from "@/hooks/use-client-mounted"

export type NavMainItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: {
    title: string
    url: string
    isActive?: boolean
    hasActiveIndicator?: boolean
  }[]
}

function NavMainMenu({
  groupLabel = "Navegación",
  items,
  queryString,
}: {
  groupLabel?: string
  items: NavMainItem[]
  queryString: string
}) {
  const hrefWithParams = (url: string) =>
    url === "#" ? "#" : `${url}${queryString ? `?${queryString}` : ""}`

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          if (item.items && item.items.length > 0) {
            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={item.isActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title} isActive={item.isActive}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={subItem.isActive}>
                            <Link href={hrefWithParams(subItem.url)} className="flex items-center justify-between w-full">
                              <span>{subItem.title}</span>
                              {subItem.hasActiveIndicator && (
                                <span className="ml-auto h-2 w-2 rounded-full bg-primary shrink-0" />
                              )}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          }
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} isActive={item.isActive}>
                <Link href={hrefWithParams(item.url)}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavMainWithSearchParams({
  groupLabel,
  items,
}: {
  groupLabel?: string
  items: NavMainItem[]
}) {
  const searchParams = useSearchParams()
  return (
    <NavMainMenu
      groupLabel={groupLabel}
      items={items}
      queryString={searchParams.toString()}
    />
  )
}

/** Sin Collapsible/Tooltip de Radix: mismo aspecto aproximado para SSR + primer paint. */
function NavMainSkeleton({
  groupLabel = "Navegación",
  rowCount = 7,
}: {
  groupLabel?: string
  rowCount?: number
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
      <div className="flex flex-col gap-1.5 px-2 py-1">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className="h-8 rounded-md bg-sidebar-accent/25 animate-pulse"
          />
        ))}
      </div>
    </SidebarGroup>
  )
}

/**
 * Defer Radix (Collapsible + Tooltip) until after hydration; `useSearchParams`
 * stays under Suspense once mounted.
 */
export function NavMain({
  groupLabel = "Navegación",
  items,
}: {
  groupLabel?: string
  items: NavMainItem[]
}) {
  const mounted = useClientMounted()
  const skeletonRows =
    groupLabel === "Despensa" ? 5 : Math.max(7, items.length + 2)

  if (!mounted) {
    return (
      <NavMainSkeleton groupLabel={groupLabel} rowCount={skeletonRows} />
    )
  }

  return (
    <Suspense
      fallback={<NavMainMenu groupLabel={groupLabel} items={items} queryString="" />}
    >
      <NavMainWithSearchParams groupLabel={groupLabel} items={items} />
    </Suspense>
  )
}
