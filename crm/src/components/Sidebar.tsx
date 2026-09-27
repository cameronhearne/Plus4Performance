"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/kanban", label: "Pipeline" },
  { href: "/contacts", label: "Contacts" },
  { href: "/settings/sequences", label: "Sequences" },
];

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-bg-elevated">
      <div className="px-5 py-6">
        <div className="text-[10px] font-medium tracking-[0.3em] text-text-muted uppercase">
          Plus4Performance
        </div>
        <div className="mt-1 text-sm font-semibold text-text">
          CRM <span className="text-accent">·</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-surface-2 text-text glow-border"
                  : "text-text-muted hover:bg-surface hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <div className="mb-3 truncate text-xs text-text-faint">{userEmail}</div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-xs font-medium text-text-muted transition hover:text-accent"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
