import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  PackageSearch,
  ArrowRightLeft,
  Truck,
  Briefcase,
  ShoppingCart,
  BarChart3,
  LogOut,
  Bell,
  Menu,
  Home,
  Shield,
  Users,
  Download,
  ClipboardCopy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import tkLogo from "@assets/tk_logo_1772726610288.png";
import { useToast } from "@/hooks/use-toast";

const FIELD_MODE_PROMPT = `You are working on the existing TK Electric VoltStock app.
Do NOT redesign everything. Keep current style.
Implement the following FIELD MODE refinements end-to-end (UI + behavior), keeping current look but fixing usability issues.
No placeholders—must work with DB and existing flows.

========================================================
0) PAGES + NAMING (FIELD MODE)
========================================================
Field Mode must have separate pages:
- Receive/Return
- Issue/Transfer  (rename everywhere from "Issue/Ship" to "Issue/Transfer")

Both pages share the same "Log Movement" form component style, but their Movement Types differ.

========================================================
A) MOVEMENT TYPE OPTIONS MUST DEPEND ON PAGE
========================================================
1) Receive/Return page:
- Movement Type dropdown must show ONLY:
  - Receive
  - Return
- Remove/hide Issue and Transfer from this page completely.

2) Issue/Transfer page:
- Movement Type dropdown must show ONLY:
  - Issue
  - Transfer
- Remove/hide Receive and Return from this page completely.

Implementation detail:
- Enforce at the UI level and also in form submission validation (reject invalid type for that page).
- Ensure the page title emphasizes the mode:
  - "Receive / Return" emphasized (bolder) on Receive/Return page
  - "Issue / Transfer" emphasized (bolder) on Issue/Transfer page
  - "Log Movement" can be secondary/subtitle.

========================================================
B) REMOVE "CREATE NEW PROJECT" FROM FIELD MODE
========================================================
In Field Mode Log Movement, the Project (Optional) dropdown currently shows "Create new project" and navigates to admin mode.
This must be removed completely in BOTH pages.

Field Mode should NEVER create projects.
Only select existing projects.

Also, project display format everywhere in field mode must be:
- "PO_NUMBER — Project Name"
(PO number first)

Project searching:
- allow typing to search by PO number OR project name
- but only selecting existing projects is allowed

========================================================
C) CONSISTENT LAYOUT FOR BOTH PAGES (RECEIVE/RETURN + ISSUE/TRANSFER)
========================================================

C1) Centered width (not full width)
- Wrap the entire form in a centered container: max-width ~ 1100-1200px, width: 100%

C2) Field arrangement (top to bottom):
1) Movement Type
2) From/To + Project (Optional) on the SAME row (2 columns)
3) Items section (BIG + readable)
4) Note (Optional) BELOW Items

C3) Items section: must show 9-10 results visibly
- Increase dropdown results max-height (target 360-420px)

C4) Item results row layout: add PHOTO + increase size
- Thumbnail size: 36-44px square, rounded corners
- SKU | PHOTO | ITEM NAME | ON HAND + UNIT (right aligned)
- Selected item row also shows the thumbnail

C5) "Add Another Item" placement
- Move to the FAR RIGHT side of the Items header row

========================================================
D) NAVIGATION BUTTONS (FIELD MODE)
========================================================
- Keep Home button
- Add Back button (left arrow) next to Home in BOTH pages
- Back should ALWAYS return to Field Actions screen (/field)

========================================================
E) PAGE-SPECIFIC FROM/TO LABELS (FIELD MODE)
========================================================
Receive/Return page:
- If type = Receive → label "Receive From"
- If type = Return → label "Return From"

Issue/Transfer page:
- If type = Issue → label "Issue To"
- If type = Transfer → label "Transfer To"`;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = user?.role === "admin";

  function copyPrompt() {
    navigator.clipboard.writeText(FIELD_MODE_PROMPT).then(() => {
      toast({ title: "Copied", description: "Field Mode prompt copied to clipboard." });
    });
  }

  const navGroups = [
    {
      label: "Main",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/inventory", label: "Inventory", icon: PackageSearch },
        { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/suppliers", label: "Suppliers", icon: Truck },
        { href: "/projects", label: "Projects", icon: Briefcase },
        { href: "/reorder", label: "Reorder", icon: ShoppingCart },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/reports", label: "Reports", icon: BarChart3 },
      ],
    },
    {
      label: "Admin Tools",
      items: [
        { href: "/admin/users", label: "User Approvals", icon: Users },
        { href: "/admin/export", label: "Export Backup", icon: Download },
      ],
    },
  ];

  const displayName = user?.name ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ") ?? user?.email ?? "User";
  const initials = displayName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-border w-64">
      <Link href="/" className="px-5 py-4 flex items-center gap-3 border-b border-border hover:bg-brand-50 transition-colors">
        <img
          src={tkLogo}
          alt="TK Electric"
          className="h-11 w-auto object-contain flex-shrink-0"
          style={{ imageRendering: "crisp-edges" }}
        />
        <div className="min-w-0">
          <span className="font-display font-bold text-xl tracking-tight text-slate-900 leading-none block">TK Electric</span>
          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-1 block flex items-center gap-1">
            <Shield className="w-2.5 h-2.5 inline" /> Admin Mode
          </span>
        </div>
      </Link>

      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 mb-1.5">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                      isActive
                        ? "bg-brand-100 text-brand-700 font-semibold"
                        : "text-slate-600 hover:bg-brand-50 hover:text-slate-900"
                    }`}
                  >
                    <item.icon
                      className={`flex-shrink-0 ${isActive ? "text-brand-700" : "text-slate-400"}`}
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border space-y-1">
        <Link
          href="/home"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          data-testid="nav-back-home"
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <Avatar className="w-8 h-8 border border-border flex-shrink-0">
            <AvatarFallback className="bg-brand-100 text-brand-700 font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 mt-1 text-sm h-9"
          onClick={() => logout()}
          data-testid="btn-sign-out"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background font-sans">
      <div className="hidden md:block flex-shrink-0">
        <SidebarContent />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 text-slate-600">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <img src={tkLogo} alt="TK Electric" className="h-7 w-auto object-contain" />
              <span className="font-display font-bold text-base text-slate-900">TK Electric</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Shield className="w-3 h-3" /> Admin Mode
            </span>
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={copyPrompt}
                className="gap-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 text-xs"
                data-testid="btn-copy-prompt"
                title="Copy Field Mode prompt to clipboard"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy Prompt</span>
              </Button>
            )}
            <Link href="/home">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-slate-600 border-slate-200"
                data-testid="btn-header-back-home"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-brand-50 relative w-9 h-9">
              <Bell className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
