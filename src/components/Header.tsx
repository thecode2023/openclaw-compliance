"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";

const publicNavItems = [
  { href: "/feed", label: "Feed" },
  { href: "/audit", label: "Audit" },
  { href: "/policies", label: "Policies" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  const navItems = [
    ...publicNavItems,
    {
      href: user ? "/dashboard" : "/auth/signin",
      label: user ? "Dashboard" : "Sign In",
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-mono font-bold text-sm tracking-wider uppercase text-[var(--text-bright)]">
            Complyze
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                pathname === item.href ||
                  (item.href === "/dashboard" &&
                    pathname.startsWith("/dashboard"))
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop sign out */}
        {!loading && user && (
          <div className="hidden sm:flex ml-auto items-center gap-2">
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Mobile hamburger */}
        <button
          className="sm:hidden ml-auto flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-border bg-background">
          <nav className="flex flex-col px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-3 py-3 text-base font-medium rounded-md transition-colors min-h-[44px] flex items-center",
                  pathname === item.href ||
                    (item.href === "/dashboard" &&
                      pathname.startsWith("/dashboard"))
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {item.label}
              </Link>
            ))}
            {!loading && user && (
              <>
                <div className="border-t border-border my-2" />
                <div className="px-3 py-1 text-sm text-muted-foreground truncate">
                  {user.email}
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="flex items-center gap-2 px-3 py-3 text-base font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent/50 transition-colors min-h-[44px]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
