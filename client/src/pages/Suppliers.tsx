import { useSuppliers } from "@/hooks/use-reference-data";
import { Truck, Phone, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Suppliers() {
  const { data: suppliers, isLoading } = useSuppliers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Suppliers</h1>
        <p className="text-slate-500 mt-1">Manage your material and tool vendors.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers?.map(supplier => (
            <Card key={supplier.id} className="premium-card border-none hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-slate-900">{supplier.name}</h3>
                  </div>
                  {supplier.preferred && <Badge className="bg-amber-100 text-amber-800 border-none">Preferred</Badge>}
                </div>
                
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="w-5 flex justify-center"><Phone className="w-4 h-4 text-slate-400" /></div>
                    {supplier.phone || 'No phone provided'}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="w-5 flex justify-center"><Mail className="w-4 h-4 text-slate-400" /></div>
                    {supplier.email || 'No email provided'}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 mt-2">
                    <span className="font-medium text-slate-900 w-5 text-center">LT</span>
                    Lead Time: {supplier.leadTime ? `${supplier.leadTime} days` : 'Unknown'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
