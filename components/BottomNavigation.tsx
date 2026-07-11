"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Disc3, Home, Library, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/player", label: "Player", Icon: Disc3 },
  { href: "/library", label: "Library", Icon: Library },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-navigation border-x-[3px] border-t-[3px] border-black bg-white shadow-[0_-5px_0_#000]">
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-black uppercase sm:text-[11px]",
              active ? "bg-[#FFD600] outline outline-[3px] outline-black" : "bg-white",
            )}
          >
            <Icon size={20} strokeWidth={3} />
            <span className="text-ellipsis max-w-full">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
