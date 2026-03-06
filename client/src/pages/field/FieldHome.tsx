import { useLocation } from "wouter";
import { Package, PackageCheck, PackageMinus, ClipboardList } from "lucide-react";

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-5 pt-1">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Field Actions</h1>
        <p className="text-slate-500 text-sm mt-1">Select an action to get started.</p>
      </div>

      {/* Primary tile: Inventory (full width, horizontal layout) */}
      <button
        onClick={() => navigate("/field/inventory")}
        data-testid="tile-inventory"
        className="group w-full bg-[#EAF7EE] rounded-2xl border-2 border-[#D9E7DD] hover:border-[#0A6B24] hover:shadow-lg transition-all duration-200 flex items-center gap-5 p-6 cursor-pointer min-h-[140px] sm:min-h-[160px]"
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-all flex-shrink-0">
          <Package className="w-7 h-7 sm:w-8 sm:h-8 text-[#0A6B24]" />
        </div>
        <div className="text-left">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Inventory</h2>
          <p className="text-sm text-slate-500 mt-1">Browse and search stock</p>
        </div>
      </button>

      {/* 3 action tiles: mobile 1 col → desktop 3 col */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Receive / Return */}
        <button
          onClick={() => navigate("/field/movement?type=receive")}
          data-testid="tile-receive"
          className="group bg-white rounded-2xl border-2 border-[#D9E7DD] hover:border-[#0A6B24] hover:bg-[#EAF7EE] hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-3 p-6 cursor-pointer min-h-[180px] sm:min-h-[200px]"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#EAF7EE] group-hover:bg-white flex items-center justify-center transition-colors shadow-sm">
            <PackageCheck className="w-7 h-7 sm:w-8 sm:h-8 text-[#0A6B24]" />
          </div>
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Receive / Return</h2>
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">Stock intake &amp; returns</p>
          </div>
        </button>

        {/* Issue / Ship */}
        <button
          onClick={() => navigate("/field/movement?type=issue")}
          data-testid="tile-issue"
          className="group bg-white rounded-2xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-3 p-6 cursor-pointer min-h-[180px] sm:min-h-[200px]"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-50 group-hover:bg-white flex items-center justify-center transition-colors shadow-sm">
            <PackageMinus className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
          </div>
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Issue / Ship</h2>
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">Issue to jobsite</p>
          </div>
        </button>

        {/* Transactions */}
        <button
          onClick={() => navigate("/field/transactions")}
          data-testid="tile-transactions"
          className="group bg-white rounded-2xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-3 p-6 cursor-pointer min-h-[180px] sm:min-h-[200px]"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 group-hover:bg-white flex items-center justify-center transition-colors shadow-sm">
            <ClipboardList className="w-7 h-7 sm:w-8 sm:h-8 text-slate-500" />
          </div>
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Transactions</h2>
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">Movement history</p>
          </div>
        </button>
      </div>
    </div>
  );
}
