import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground border-transparent",
        info: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/40 dark:text-blue-50 dark:border-blue-800",
        success:
          "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-50 dark:border-emerald-800",
        warning:
          "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-50 dark:border-amber-800",
        danger:
          "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/40 dark:text-rose-50 dark:border-rose-800",
        outline: "border border-input bg-background text-foreground",
      },
      size: {
        sm: "px-2 py-0.5",
        md: "px-2.5 py-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

