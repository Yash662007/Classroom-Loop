"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Filter,
  GraduationCap,
  History,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MoreHorizontal,
  Settings,
  Sprout,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { ConnectionStatus } from "@/components/ConnectionStatus";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Role navigation lives here (client side) so server layouts never pass
 * component references across the server/client boundary.
 */
const LINKS_BY_ROLE: Record<string, NavLink[]> = {
  teacher: [
    { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
    { href: "/teacher/competencies", label: "Training & Competencies", icon: GraduationCap },
    { href: "/teacher/task", label: "My Task", icon: ClipboardList },
    { href: "/teacher/history", label: "Progress & History", icon: History },
    { href: "/teacher/context", label: "My Context", icon: Settings },
  ],
  mentor: [
    { href: "/mentor", label: "Dashboard", icon: LayoutDashboard },
    { href: "/mentor/queue", label: "Evidence Review", icon: ClipboardCheck },
    { href: "/mentor/teachers", label: "Teachers", icon: Users },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/funnel", label: "Funnel", icon: Filter },
    { href: "/admin/analytics", label: "Implementation", icon: BarChart3 },
    { href: "/admin/adoption", label: "Adoption", icon: Sprout },
    { href: "/admin/support", label: "Intervention", icon: LifeBuoy },
  ],
};

const ROOTS = new Set(["/teacher", "/mentor", "/admin"]);

const ROLE_LABEL: Record<string, string> = {
  teacher: "Teacher",
  mentor: "Mentor",
  admin: "District Admin",
};

function NavLinks({ links, onNavigate }: { links: NavLink[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {links.map((l) => {
        const active = pathname === l.href || (!ROOTS.has(l.href) && pathname.startsWith(l.href + "/"));
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-softblue-300 ${
              active
                ? "bg-white/10 font-semibold text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{l.label}</span>
            {active && <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-softblue-300" />}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-2.5 py-1.5 text-xs text-white/85 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

function SidebarInner({
  role,
  name,
  links,
  onNavigate,
}: {
  role: string;
  name: string;
  links: NavLink[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={30} height={30} />
        <div className="min-w-0">
          <p className="font-bold text-sm tracking-wide leading-tight">CLASSROOM LOOP</p>
          <p className="text-[11px] text-white/55 leading-tight">{ROLE_LABEL[role] ?? role}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks links={links} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2">
        <span className="text-xs text-white/70 truncate max-w-[140px]" title={name}>
          {name}
        </span>
        <SignOutButton />
      </div>
    </div>
  );
}

function Topbar({ onOpenMenu, role }: { onOpenMenu: () => void; role: string }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg text-navy-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <span className="lg:hidden font-bold text-sm tracking-wide text-navy-900 truncate">CLASSROOM LOOP</span>
          <span className="hidden lg:block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {ROLE_LABEL[role] ?? role} workspace
          </span>
        </div>
        <ConnectionStatus />
      </div>
    </header>
  );
}

/**
 * Application shell (spec §9): persistent sidebar on desktop, drawer + topbar
 * on mobile. The sidebar clearly distinguishes the current section; the
 * connection chip answers "is my work safe?" at all times (spec §26).
 */
export function AppShell({
  role,
  name,
  children,
}: {
  role: string;
  name: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = LINKS_BY_ROLE[role] ?? [];

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40" aria-label="Sidebar">
        <SidebarInner role={role} name={name} links={links} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-navy-900/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-card">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute top-3 right-3 z-10 inline-flex items-center justify-center h-9 w-9 rounded-lg text-white/80 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <SidebarInner role={role} name={name} links={links} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onOpenMenu={() => setMenuOpen(true)} role={role} />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">{children}</main>
        {/* Mobile-first bottom navigation for teachers (Master Task GOAL 19). */}
        {role === "teacher" && <BottomNav onMore={() => setMenuOpen(true)} />}
      </div>
    </div>
  );
}

const BOTTOM_NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/teacher", label: "Home", icon: Home },
  { href: "/teacher/task", label: "Practice", icon: ClipboardList },
  { href: "/teacher/history", label: "Progress", icon: History },
];

function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {BOTTOM_NAV.map((l) => {
          const active = pathname === l.href || (l.href !== "/teacher" && pathname.startsWith(l.href));
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] min-h-[56px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 ${
                active ? "text-primary-600 font-semibold" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {l.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] min-h-[56px] text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          More
        </button>
      </div>
    </nav>
  );
}
