import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

export default function Export() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const TABLES = useMemo(() => [
    { key: "categories",                  label: t.adminExportTableCategories },
    { key: "locations",                   label: t.adminExportTableLocations },
    { key: "suppliers",                   label: t.adminExportTableSuppliers },
    { key: "projects",                    label: t.adminExportTableProjects },
    { key: "items",                       label: t.adminExportTableItems },
    { key: "item_groups",                 label: t.adminExportTableItemGroups },
    { key: "inventory_movements",         label: t.adminExportTableMovements },
    { key: "inventory_location_balances", label: t.adminExportTableLocationBalances },
    { key: "users",                       label: t.adminExportTableUsers },
  ], [t]);

  async function downloadCsv(tableKey: string, label: string) {
    setDownloading(tableKey);
    try {
      const resp = await fetch(`/api/admin/export/${tableKey}`, { credentials: "include" });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: t.adminExportDownloadFailed }));
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
      toast({ title: `${label} ${t.adminExportExported}`, description: `${tableKey}.csv ${t.adminExportDownloadedSuffix}` });
    } catch (err: any) {
      toast({ title: t.adminExportFailed, description: err.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAll() {
    for (const tbl of TABLES) {
      await downloadCsv(tbl.key, tbl.label);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <Download className="w-6 h-6 text-brand-700" />
          {t.adminExportTitle}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {t.adminExportSubtitle}
        </p>
      </div>

      <Button
        onClick={downloadAll}
        disabled={!!downloading}
        className="gap-2 bg-brand-700 hover:bg-brand-800 text-white"
        data-testid="btn-export-all"
      >
        <Download className="w-4 h-4" />
        {downloading ? `${t.adminExportDownloading} ${downloading}…` : t.adminExportAll}
      </Button>

      <div className="space-y-2">
        {TABLES.map(tbl => (
          <div
            key={tbl.key}
            className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-4"
            data-testid={`row-export-${tbl.key}`}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-slate-400" />
              <div>
                <p className="font-medium text-slate-900 text-sm">{tbl.label}</p>
                <p className="text-xs text-slate-400">{tbl.key}.csv</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCsv(tbl.key, tbl.label)}
              disabled={!!downloading}
              className="gap-1.5 text-slate-600"
              data-testid={`btn-export-${tbl.key}`}
            >
              {downloading === tbl.key ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {t.adminExportDownloadingShort}</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> {t.adminExportDownload}</>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
