import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function BrutalCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "brutal-surface min-w-0 bg-white p-4",
        className,
      )}
      {...props}
    />
  );
}
