import { Link, useLocation } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import tkLogo from "@assets/tk_logo_1772726610288.png";
import { HardHat } from "lucide-react";

export function FieldLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isFieldHome = location === "/field";

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: "#0E1512" }}>

      {/* Subtle radial glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(10,107,36,0.16) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      {/* Top header */}
      <header
        className="relative z-10 h-14 flex items-center justify-between px-5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Left: logo + Field Mode pill */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={tkLogo}
            alt="TK Electric"
            className="h-12 w-auto object-contain flex-shrink-0"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          {/* Field Mode pill */}
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide flex-shrink-0"
            style={{
              background: "rgba(10,107,36,0.25)",
              border: "1px solid rgba(61,214,140,0.25)",
              color: "#3DD68C",
            }}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>Field Mode</span>
          </div>
        </div>

        {/* Right: Back + Home + user avatar */}
        <div className="flex items-center gap-1">
          {!isFieldHome && (
            <Link href="/field">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                style={{ color: "rgba(255,255,255,0.40)" }}
                data-testid="btn-field-back"
                title="Back to Field Actions"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          )}
          <Link href="/home">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              style={{ color: "rgba(255,255,255,0.40)" }}
              data-testid="btn-field-home"
              title="Mode Select"
            >
              <Home className="w-4 h-4" />
            </Button>
          </Link>

          {/* User avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center ml-1 flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto flex flex-col" style={{ background: "#F0F4F1" }}>
        <div className={`flex-1 flex flex-col w-full mx-auto px-4 md:px-6 ${
          location.startsWith("/field/inventory") || location.startsWith("/field/transactions")
            ? "max-w-7xl"
            : location.startsWith("/field/movement")
            ? "max-w-[1100px]"
            : "max-w-6xl"
        }`}>
          {children}
        </div>
      </main>
    </div>
  );
}
