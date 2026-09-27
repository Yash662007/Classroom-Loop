"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/funnel", label: "Funnel" },
  { href: "/admin/analytics", label: "Implementation" },
  { href: "/admin/adoption", label: "Adoption" },
  { href: "/admin/support", label: "Support" },
];

export function AdminNav({ name }: { name: string }) {
  const pathname = usePathname();
  return (
    <header className="bg-navy-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/admin" className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span className="font-bold text-sm tracking-wide hidden sm:block">CLASSROOM LOOP · ADMIN</span>
        </Link>
        <nav aria-label="Admin navigation" className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${active ? "bg-white/15 font-semibold" : "text-white/75 hover:bg-white/10"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-white/60 hidden md:block max-w-[140px] truncate" title={name}>{name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
