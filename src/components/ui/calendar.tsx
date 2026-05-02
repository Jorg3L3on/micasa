"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar built on React DayPicker v9. Requires `react-day-picker/style.css`
 * (imported in globals.css). Defaults to Spanish locale and navigation flanking
 * the month caption.
 */
function Calendar({
  className,
  locale = es,
  showOutsideDays = true,
  navLayout = "around",
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      navLayout={navLayout}
      className={cn("w-full", className)}
      {...props}
    />
  );
}

export { Calendar };
