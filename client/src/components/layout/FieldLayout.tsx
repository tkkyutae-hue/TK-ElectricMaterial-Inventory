import { Link } from "wouter";
import { Home, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export function FieldLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col font-sans">
      {/* Top header: Left = branding, Right = nav buttons */}
      <header className="h-14 bg-white border-b border-[#D9E7DD] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10 shadow-sm">

        {/* Left: TK logo + company name + Field badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={tkLogo} alt="TK Electric" className="h-7 w-auto object-contain flex-shrink-0" />
          <div className="hidden sm:block min-w-0">
            <span className="font-display font-bold text-sm text-slate-900 leading-none block truncate">TK Electric</span>
            <span className="text-[10px] text-slate-400 leading-none">VoltStock</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6B24] bg-[#EAF7EE] px-2 py-0.5 rounded-full border border-[#D9E7DD] flex-shrink-0">
            Field
          </span>
        </div>

        {/* Right: Back + Home + user avatar */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="gap-1 text-slate-600 hover:text-slate-900 hover:bg-[#EAF7EE] px-2 h-8"
            data-testid="btn-field-back"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Back</span>
          </Button>

          <Link href="/home">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-slate-600 hover:text-[#0A6B24] hover:bg-[#EAF7EE] px-2 h-8"
              data-testid="btn-field-home"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Home</span>
            </Button>
          </Link>

          <div className="w-7 h-7 rounded-full bg-[#EAF7EE] border border-[#D9E7DD] flex items-center justify-center ml-1">
            <span className="text-xs font-bold text-[#0A6B24]">
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
