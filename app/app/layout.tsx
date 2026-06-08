"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, UserButton } from "@clerk/nextjs";
import {
  Briefcase,
  FileText,
  MessageSquare,
  Settings,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMyProfile } from "@/lib/api";

const tabs = [
  { href: "/app/chat", label: "Chat", icon: MessageSquare },
  { href: "/app/files", label: "Files", icon: FileText },
  { href: "/app/applications", label: "Applications", icon: Briefcase },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [gateState, setGateState] = useState<"checking" | "ready">("checking");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const profile = await getMyProfile(getToken);
        if (cancelled) return;

        if (!profile) {
          router.replace("/onboarding");
          return;
        }

        setGateState("ready");
      } catch {
        // If the check itself fails (network/auth hiccup), don't trap the
        // user — let them through and individual pages can surface errors.
        if (!cancelled) setGateState("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  if (gateState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center ring-1 ring-primary/15 animate-pulse">
            <TrendingUp className="w-4 h-4 text-accent-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
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
            <span
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              Aprise
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 flex flex-col gap-0.5">
          {tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className={cn(
                  "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <tab.icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")} />
                {!collapsed && <span className="truncate">{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-border/50 flex flex-col gap-0.5">
          <button className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150 w-full">
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
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
              {tabs.find((t) => pathname?.startsWith(t.href))?.label ?? "Aprise"}
            </p>
          </div>
          <UserButton />
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
