import { Link } from "wouter";
import { Home, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export function FieldLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Top header — no sidebar */}
      <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10">
        <Link href="/home">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-600 hover:text-slate-900 -ml-2"
            data-testid="btn-field-back-home"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Home</span>
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <img src={tkLogo} alt="TK Electric" className="h-7 w-auto object-contain" />
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
            Field Mode
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-xs font-bold text-brand-700">
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <span className="hidden sm:inline text-sm text-slate-500 max-w-[120px] truncate">
            {user?.firstName ?? user?.email ?? ""}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
