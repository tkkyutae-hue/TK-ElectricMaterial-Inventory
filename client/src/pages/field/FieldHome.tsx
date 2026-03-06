import { useLocation } from "wouter";
import { Package, PackageCheck, PackageMinus, ClipboardList } from "lucide-react";

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-4 pt-2">
      <div className="text-center mb-5">
        <h1 className="text-2xl font-display font-bold text-slate-900">Field Actions</h1>
        <p className="text-[#64748B] text-sm mt-1">Select an action to get started.</p>
      </div>

      {/* Large primary tile: Inventory */}
      <button
        onClick={() => navigate("/field/inventory")}
        data-testid="tile-inventory"
        className="group w-full bg-[#EAF7EE] rounded-2xl border-2 border-[#D9E7DD] hover:border-[#0A6B24] hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-4 py-7 px-6 cursor-pointer"
      >
        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:shadow transition-all">
          <Package className="w-6 h-6 text-[#0A6B24]" />
        </div>
        <div className="text-left">
          <h2 className="text-lg font-bold text-slate-900">Inventory</h2>
          <p className="text-sm text-[#64748B] mt-0.5">Browse and search stock</p>
        </div>
      </button>

      {/* 3 equal tiles in one row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Receive / Return */}
        <button
          onClick={() => navigate("/field/movement?type=receive")}
          data-testid="tile-receive"
          className="group bg-white rounded-2xl border-2 border-[#D9E7DD] hover:border-[#0A6B24] hover:bg-[#EAF7EE] hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-2.5 py-5 px-2 cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#EAF7EE] group-hover:bg-white flex items-center justify-center transition-colors shadow-sm">
            <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#0A6B24]" />
          </div>
          <h2 className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight text-center">Receive /<br />Return</h2>
        </button>

        {/* Issue / Ship */}
        <button
          onClick={() => navigate("/field/movement?type=issue")}
          data-testid="tile-issue"
          className="group bg-white rounded-2xl border-2 border-[#D9E7DD] hover:border-violet-400 hover:bg-violet-50 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-2.5 py-5 px-2 cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-50 group-hover:bg-white flex items-center justify-center transition-colors shadow-sm">
            <PackageMinus className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600" />
          </div>
          <h2 className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight text-center">Issue /<br />Ship</h2>
        </button>

        {/* Transactions */}
        <button
          onClick={() => navigate("/field/transactions")}
          data-testid="tile-transactions"
          className="group bg-white rounded-2xl border-2 border-[#D9E7DD] hover:border-slate-400 hover:bg-slate-50 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-2.5 py-5 px-2 cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 group-hover:bg-white flex items-center justify-center transition-colors shadow-sm">
            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
          </div>
          <h2 className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight text-center">Trans&shy;actions</h2>
        </button>
      </div>
    </div>
  );
}
