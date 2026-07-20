"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type BrutalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "orange" | "yellow" | "cyan" | "green" | "pink" | "white" | "black";
  icon?: ReactNode;
};

const tones = {
  orange: "bg-[#FF4D00] text-white",
  yellow: "bg-[#FFD600] text-[#111]",
  cyan: "bg-[#00C2FF] text-[#111]",
  green: "bg-[#29FF87] text-[#111]",
  pink: "bg-[#FF3B6B] text-white",
  white: "bg-white text-[#111]",
  black: "bg-[#111] text-white",
};

export function BrutalButton({
  tone = "orange",
  icon,
  className,
  children,
  type = "button",
  ...props
}: BrutalButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "brutal-button inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-[14px] border-[3px] border-black px-4 py-2 text-sm font-black uppercase shadow-[4px_4px_0_#000] transition active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
