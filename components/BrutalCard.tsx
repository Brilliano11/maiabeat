import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function BrutalCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const hasBackgroundClass = typeof className === "string" && /\bbg-/.test(className);

  return (
    <div
      className={cn(
        "brutal-surface min-w-0 p-4",
        !hasBackgroundClass && "bg-white",
        className,
      )}
      {...props}
    />
  );
}
