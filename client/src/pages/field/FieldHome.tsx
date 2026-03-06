import { useLocation } from "wouter";
import { PackageCheck, PackageMinus, Search, ClipboardList } from "lucide-react";

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-4 pt-2">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Field Actions</h1>
        <p className="text-slate-500 text-sm mt-1">Select an action to get started.</p>
      </div>

      {/* Large primary tile: Inventory (full width) */}
      <button
        onClick={() => navigate("/field/inventory")}
        data-testid="tile-inventory"
        className="group w-full bg-white rounded-2xl border-2 border-slate-200 hover:border-sky-400 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-3 py-8 px-6 cursor-pointer"
      >
        <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center group-hover:bg-sky-100 transition-colors">
          <Search className="w-6 h-6 text-sky-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">Inventory</h2>
          <p className="text-sm text-slate-500 mt-0.5">Search and browse stock</p>
        </div>
      </button>

      {/* 3 equal tiles in a row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <button
          onClick={() => navigate("/field/movement?type=receive")}
          data-testid="tile-receive"
          className="group bg-white rounded-2xl border-2 border-slate-200 hover:border-green-400 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 cursor-pointer aspect-square"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
            <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Receive /<br className="sm:hidden" /> Return</h2>
          </div>
        </button>

        <button
          onClick={() => navigate("/field/movement?type=issue")}
          data-testid="tile-issue"
          className="group bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-400 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 cursor-pointer aspect-square"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
            <PackageMinus className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Issue /<br className="sm:hidden" /> Ship</h2>
          </div>
        </button>

        <button
          onClick={() => navigate("/field/transactions")}
          data-testid="tile-transactions"
          className="group bg-white rounded-2xl border-2 border-slate-200 hover:border-slate-400 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 cursor-pointer aspect-square"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Trans&shy;actions</h2>
          </div>
        </button>
      </div>
    </div>
  );
}
