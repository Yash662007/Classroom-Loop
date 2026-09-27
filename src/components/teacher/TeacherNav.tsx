"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

const LINKS = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/task", label: "My Task" },
  { href: "/teacher/competencies", label: "Competencies" },
  { href: "/teacher/context", label: "My Context" },
  { href: "/teacher/history", label: "History" },
];

export function TeacherNav({ name }: { name: string }) {
  const pathname = usePathname();
  return (
    <header className="bg-navy-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/teacher" className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span className="font-bold text-sm tracking-wide hidden sm:block">CLASSROOM LOOP</span>
        </Link>
        <nav aria-label="Teacher navigation" className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== "/teacher" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active ? "bg-white/15 font-semibold" : "text-white/75 hover:bg-white/10"
                }`}
              >
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
