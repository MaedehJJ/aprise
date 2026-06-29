"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Briefcase,
  ChevronRight,
  FileText,
  MessageSquare,
  Settings,
  Tags,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMyProfile } from "@/lib/api";
import { FirstRunChecklist } from "./FirstRunChecklist";
import { AppDataProvider } from "./AppDataProvider";

const tabs = [
  { href: "/app/chat", label: "Chat", icon: MessageSquare },
  { href: "/app/files", label: "Files", icon: FileText },
  { href: "/app/applications", label: "Applications", icon: Briefcase },
  { href: "/app/browse", label: "Browse", icon: Tags },
  { href: "/app/stars", label: "STAR Library", icon: BookOpen },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { getToken } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (pendingHref && pathname?.startsWith(pendingHref)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  useEffect(() => {
    void getMyProfile(getToken).then((p) => {
      if (p?.name) setUserName(p.name);
    });
  }, [getToken]);

  const activePath = pendingHref ?? pathname;
  const activeTab = tabs.find((t) => activePath?.startsWith(t.href));

  return (
    <AppDataProvider>
    <div className="flex h-screen bg-background overflow-hidden">
      <aside
        className={cn(
          "flex flex-col border-r border-border/60 bg-sidebar transition-all duration-300 ease-out shrink-0",
          collapsed ? "w-14" : "w-52"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border/50">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm shrink-0">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight">
              Aprise
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 flex flex-col gap-0.5">
          {tabs.map((tab) => {
            const active = activePath?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch
                onClick={() => setPendingHref(tab.href)}
                className={cn(
                  "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <tab.icon
                  className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")}
                />
                {!collapsed && <span className="truncate">{tab.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-border/50 flex flex-col gap-0.5">
          {!collapsed && userName && (
            <p className="px-2.5 py-1 text-[10px] text-muted-foreground truncate">
              {userName}
            </p>
          )}
          <Link
            href="/app/settings"
            prefetch
            onClick={() => setPendingHref("/app/settings")}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full",
              activePath?.startsWith("/app/settings")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150 w-full"
          >
            <ChevronRight
              className={cn(
                "w-4 h-4 shrink-0 transition-transform duration-300",
                collapsed ? "" : "rotate-180"
              )}
            />
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-background/80 backdrop-blur-sm shrink-0">
          <div>
            <p className="text-xs font-semibold text-foreground">
              {activeTab?.label ??
                (activePath?.startsWith("/app/settings")
                  ? "Settings"
                  : activePath?.startsWith("/app/roles")
                  ? "Role workspace"
                  : "Aprise")}
              {activePath?.startsWith("/app/browse") ? " by Tag" : ""}
            </p>
          </div>
          <UserButton />
        </header>

        <FirstRunChecklist />

        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
    </AppDataProvider>
  );
}
