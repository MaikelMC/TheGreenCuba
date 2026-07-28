"use client";

import { cn } from "@/lib/utils";

type ActivityType = "search" | "view" | "save" | "nav";

interface ActivityItemProps {
  type: ActivityType;
  children: React.ReactNode;
  time: string;
  className?: string;
}

const dotStyles: Record<ActivityType, string> = {
  search: "bg-accent",
  view: "bg-lv-blue",
  save: "bg-lv-amber",
  nav: "bg-lv-teal",
};

export function ActivityItem({ type, children, time, className }: ActivityItemProps) {
  return (
    <div className={cn("flex items-center gap-gap-sm py-gap-sm border-b border-border last:border-b-0", className)}>
      <span className={cn("size-2 rounded-full shrink-0", dotStyles[type])} />
      <span className="flex-1 text-small min-w-0 [&_strong]:font-semibold">
        {children}
      </span>
      <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  );
}
