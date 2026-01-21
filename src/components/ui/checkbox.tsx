"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, disabled, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(e.target.checked)
      }
      // Also call the original onChange if it exists
      if (onChange) {
        onChange(e)
      }
    }

    return (
      <input
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-input accent-primary",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        ref={ref}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
