"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list text-muted-foreground inline-flex items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "w-fit rounded-lg bg-muted p-[3px] group-data-[orientation=horizontal]/tabs:h-9",
        line: "w-fit gap-1 rounded-none bg-transparent p-[3px] group-data-[orientation=horizontal]/tabs:h-9",
        segmented:
          "relative isolate flex h-8 w-full touch-none select-none rounded-full bg-[rgba(118,118,128,0.12)] p-[2px] backdrop-blur-sm group-data-[orientation=horizontal]/tabs:h-8 dark:bg-[rgba(118,118,128,0.24)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 data-[state=active]:text-foreground",
        "after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5",
        "after:bg-foreground group-data-[variant=line]/tabs-list:after:bottom-[-5px] group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        "group-data-[variant=segmented]/tabs-list:z-10 group-data-[variant=segmented]/tabs-list:h-full group-data-[variant=segmented]/tabs-list:rounded-full group-data-[variant=segmented]/tabs-list:bg-transparent group-data-[variant=segmented]/tabs-list:px-2 group-data-[variant=segmented]/tabs-list:text-[13px] group-data-[variant=segmented]/tabs-list:font-medium group-data-[variant=segmented]/tabs-list:text-foreground/55 group-data-[variant=segmented]/tabs-list:shadow-none group-data-[variant=segmented]/tabs-list:after:hidden",
        "group-data-[variant=segmented]/tabs-list:before:absolute group-data-[variant=segmented]/tabs-list:before:left-0 group-data-[variant=segmented]/tabs-list:before:top-1/2 group-data-[variant=segmented]/tabs-list:before:h-3.5 group-data-[variant=segmented]/tabs-list:before:w-px group-data-[variant=segmented]/tabs-list:before:-translate-y-1/2 group-data-[variant=segmented]/tabs-list:before:bg-[rgba(60,60,67,0.29)] group-data-[variant=segmented]/tabs-list:before:transition-opacity group-data-[variant=segmented]/tabs-list:before:content-[''] group-data-[variant=segmented]/tabs-list:first-of-type:before:hidden dark:group-data-[variant=segmented]/tabs-list:before:bg-[rgba(84,84,88,0.65)]",
        "group-data-[variant=segmented]/tabs-list:hover:bg-transparent group-data-[variant=segmented]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=segmented]/tabs-list:data-[state=active]:font-medium group-data-[variant=segmented]/tabs-list:data-[state=active]:text-foreground group-data-[variant=segmented]/tabs-list:data-[state=active]:shadow-none group-data-[variant=segmented]/tabs-list:data-[state=active]:before:opacity-0 group-data-[variant=segmented]/tabs-list:data-[state=active]:[&+[data-slot=tabs-trigger]]:before:opacity-0 dark:group-data-[variant=segmented]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=segmented]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=segmented]/tabs-list:data-[state=active]:text-white",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
