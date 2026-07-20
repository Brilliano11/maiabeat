"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Disc3, Home, Library, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/player", label: "Player", Icon: Disc3 },
  { href: "/library", label: "Library", Icon: Library },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <div className="bottom-navigation-shell">
      <nav className="bottom-navigation" aria-label="Primary navigation">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "bottom-navigation-item",
                active && "bottom-navigation-item-active",
              )}
            >
              <Icon size={20} strokeWidth={3.2} />
              <span className="text-ellipsis max-w-full">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
