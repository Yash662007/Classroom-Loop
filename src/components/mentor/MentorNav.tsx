"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

const LINKS = [
  { href: "/mentor", label: "Overview" },
  { href: "/mentor/queue", label: "Review queue" },
  { href: "/mentor/teachers", label: "Teachers" },
];

export function MentorNav({ name }: { name: string }) {
  const pathname = usePathname();
  return (
    <header className="bg-navy-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/mentor" className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span className="font-bold text-sm tracking-wide hidden sm:block">CLASSROOM LOOP</span>
        </Link>
        <nav aria-label="Mentor navigation" className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== "/mentor" && pathname.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${active ? "bg-white/15 font-semibold" : "text-white/75 hover:bg-white/10"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-white/60 hidden md:block max-w-[180px] truncate" title={name}>{name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
