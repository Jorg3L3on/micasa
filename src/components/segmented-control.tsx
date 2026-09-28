import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs';
import { cn } from '@/lib/utils';

export type SegmentedOption = {
  value: string;
  label: ReactNode;
  ariaLabel?: string;
  title?: string;
};

type SegmentedControlProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: readonly SegmentedOption[];
  ariaLabel: string;
  className?: string;
  frameClassName?: string;
  listClassName?: string;
  wrapperClassName?: string;
  triggerClassName?: string;
  indicatorClassName?: string;
  activeLabelClassName?: string;
  stretch?: boolean;
  /** Rendered beside the list inside `frameClassName` (sort menu, etc.). */
  accessory?: ReactNode;
  children?: ReactNode;
};

/**
 * Two or three views on the motion tabs. Reduced motion comes from Tabs
 * (MotionConfig duration 0).
 */
export const SegmentedControl = ({
  value,
  defaultValue,
  onValueChange,
  options,
  ariaLabel,
  className,
  frameClassName,
  listClassName,
  wrapperClassName,
  triggerClassName,
  indicatorClassName,
  activeLabelClassName,
  stretch = false,
  accessory,
  children,
}: SegmentedControlProps) => {
  const list = (
    <TabsList
      aria-label={ariaLabel}
      className={listClassName}
      wrapperClassName={wrapperClassName}
    >
      {options.map((option) => (
        <TabsTrigger
          key={option.value}
          value={option.value}
          stretch={stretch}
          aria-label={option.ariaLabel}
          title={option.title}
          indicatorClassName={indicatorClassName}
          activeLabelClassName={activeLabelClassName}
          className={cn('min-h-11 sm:min-h-9', triggerClassName)}
        >
          {option.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  return (
    <Tabs
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      variant="pill"
      className={className}
    >
      {frameClassName ? (
        <div className={frameClassName}>
          {list}
          {accessory}
        </div>
      ) : (
        list
      )}
      {children}
    </Tabs>
  );
};
