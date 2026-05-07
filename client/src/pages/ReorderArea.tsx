import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, History } from "lucide-react";
import Reorder from "@/pages/Reorder";
import ReorderHistory from "@/pages/ReorderHistory";
import { useLanguage } from "@/hooks/use-language";

function parseTab(search: string): "recommendations" | "history" {
  const sp = new URLSearchParams(search);
  return sp.get("tab") === "history" ? "history" : "recommendations";
}

export default function ReorderArea() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [tab, setTab] = useState<"recommendations" | "history">(() => parseTab(search));

  useEffect(() => {
    setTab(parseTab(search));
  }, [search]);

  const handleChange = (v: string) => {
    const next = v === "history" ? "history" : "recommendations";
    const path = next === "history" ? "/reorder?tab=history" : "/reorder";
    navigate(path, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">{t.reorderTitle}</h1>
        <p className="text-slate-500 mt-1">{t.reorderSubtitle}</p>
      </div>

      <Tabs value={tab} onValueChange={handleChange} className="space-y-0">
        <TabsList
          className="bg-transparent p-0 h-auto rounded-none border-b border-slate-200 w-full justify-start gap-1"
        >
          <TabsTrigger
            value="recommendations"
            className="rounded-none border-b-2 border-transparent bg-transparent shadow-none px-4 pb-2.5 -mb-px gap-2 whitespace-nowrap text-slate-500 hover:text-slate-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-slate-900 data-[state=active]:text-slate-900"
            data-testid="tab-reorder-recommendations"
          >
            <ShoppingCart className="w-4 h-4 flex-shrink-0" />
            {t.reorderTabRecommendations}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-none border-b-2 border-transparent bg-transparent shadow-none px-4 pb-2.5 -mb-px gap-2 whitespace-nowrap text-slate-500 hover:text-slate-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-slate-900 data-[state=active]:text-slate-900"
            data-testid="tab-reorder-history"
          >
            <History className="w-4 h-4 flex-shrink-0" />
            {t.reorderTabHistory}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="mt-4">
          <Reorder />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <ReorderHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
