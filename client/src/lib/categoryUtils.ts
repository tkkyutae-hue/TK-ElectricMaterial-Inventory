export const CATEGORY_GRADIENTS: Record<string, string> = {
  "CT": "from-sky-700 to-sky-900",
  "CF": "from-slate-600 to-slate-800",
  "CS": "from-zinc-600 to-zinc-800",
  "CW": "from-orange-600 to-orange-900",
  "DV": "from-violet-600 to-violet-900",
  "FH": "from-stone-600 to-stone-800",
  "BC": "from-brand-600 to-brand-900",
  "DP": "from-indigo-700 to-indigo-900",
  "GT": "from-teal-600 to-teal-900",
  "TM": "from-amber-600 to-amber-900",
};

export function getCategoryGradient(code?: string | null): string {
  return CATEGORY_GRADIENTS[code ?? ""] ?? "from-slate-600 to-slate-800";
}
