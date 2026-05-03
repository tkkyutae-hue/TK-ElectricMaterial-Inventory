import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, History } from "lucide-react";
import Reorder from "@/pages/Reorder";
import ReorderHistory from "@/pages/ReorderHistory";
import { useLanguage } from "@/hooks/use-language";

function readTabFromUrl(): "recommendations" | "history" {
  if (typeof window === "undefined") return "recommendations";
  const sp = new URLSearchParams(window.location.search);
  return sp.get("tab") === "history" ? "history" : "recommendations";
}

export default function ReorderArea() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"recommendations" | "history">(readTabFromUrl);

  useEffect(() => {
    const onPop = () => setTab(readTabFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleChange = (v: string) => {
    const next = v === "history" ? "history" : "recommendations";
    setTab(next);
    const path = next === "history" ? "/reorder?tab=history" : "/reorder";
    navigate(path, { replace: true });
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={handleChange}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger
            value="recommendations"
            className="rounded-lg gap-2 whitespace-nowrap"
            data-testid="tab-reorder-recommendations"
          >
            <ShoppingCart className="w-4 h-4 flex-shrink-0" />
            {t.reorderTabRecommendations}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-lg gap-2 whitespace-nowrap"
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
