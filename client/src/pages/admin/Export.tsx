import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TABLES = [
  { key: "categories",                  label: "Categories" },
  { key: "locations",                   label: "Locations" },
  { key: "suppliers",                   label: "Suppliers" },
  { key: "projects",                    label: "Projects" },
  { key: "items",                       label: "Items" },
  { key: "item_groups",                 label: "Item Groups (Families)" },
  { key: "inventory_movements",         label: "Inventory Movements" },
  { key: "inventory_location_balances", label: "Location Balances" },
  { key: "users",                       label: "Users" },
];

export default function Export() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadCsv(tableKey: string, label: string) {
    setDownloading(tableKey);
    try {
      const resp = await fetch(`/api/admin/export/${tableKey}`, { credentials: "include" });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Download failed" }));
        throw new Error(err.message);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tableKey}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `${label} exported`, description: `${tableKey}.csv downloaded.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAll() {
    for (const t of TABLES) {
      await downloadCsv(t.key, t.label);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <Download className="w-6 h-6 text-brand-700" />
          Export Backup (CSV)
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Download individual tables as CSV files for backup or reporting.
        </p>
      </div>

      <Button
        onClick={downloadAll}
        disabled={!!downloading}
        className="gap-2 bg-brand-700 hover:bg-brand-800 text-white"
        data-testid="btn-export-all"
      >
        <Download className="w-4 h-4" />
        {downloading ? `Downloading ${downloading}…` : "Download All Tables"}
      </Button>

      <div className="space-y-2">
        {TABLES.map(t => (
          <div
            key={t.key}
            className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-4"
            data-testid={`row-export-${t.key}`}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-slate-400" />
              <div>
                <p className="font-medium text-slate-900 text-sm">{t.label}</p>
                <p className="text-xs text-slate-400">{t.key}.csv</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCsv(t.key, t.label)}
              disabled={!!downloading}
              className="gap-1.5 text-slate-600"
              data-testid={`btn-export-${t.key}`}
            >
              {downloading === t.key ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Downloading…</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Download</>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
