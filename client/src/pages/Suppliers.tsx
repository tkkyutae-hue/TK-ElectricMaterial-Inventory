import { useState } from "react";
import { useSuppliers, useCreateSupplier } from "@/hooks/use-reference-data";
import { Truck, Phone, Mail, Plus, Star, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { Link } from "wouter";

export default function Suppliers() {
  const { data: suppliers, isLoading } = useSuppliers();
  const createMutation = useCreateSupplier();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm({
    defaultValues: { name: "", contactName: "", phone: "", email: "", address: "", leadTimeDays: 1, preferredVendor: false, notes: "" }
  });

  const filtered = suppliers?.filter((s: any) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.contactName || '').toLowerCase().includes(search.toLowerCase())
  );

  function onSubmit(data: any) {
    createMutation.mutate({ ...data, leadTimeDays: Number(data.leadTimeDays) }, {
      onSuccess: () => { setDialogOpen(false); form.reset(); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Suppliers</h1>
          <p className="text-slate-500 mt-1">Manage your material and tool vendors.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Input
              placeholder="Search suppliers..."
              className="pl-4 bg-white w-52"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" />Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="col-span-2"><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="Graybar Electric" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="contactName" render={({ field }) => (
                      <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input placeholder="John Smith" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="leadTimeDays" render={({ field }) => (
                      <FormItem><FormLabel>Lead Time (days)</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="555-0101" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="sales@supplier.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="123 Industrial Blvd, Dallas TX" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="preferredVendor" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="!mt-0">Preferred Vendor</FormLabel>
                    </FormItem>
                  )} />
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={createMutation.isPending} className="bg-brand-700 hover:bg-brand-800">
                      {createMutation.isPending ? "Creating..." : "Add Supplier"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="premium-card bg-white p-16 text-center">
          <Truck className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="font-semibold text-slate-900">No suppliers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered?.map((supplier: any) => (
            <Link key={supplier.id} href={`/suppliers/${supplier.id}`}>
              <Card className="premium-card border-none hover:-translate-y-0.5 cursor-pointer transition-all">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-brand-600" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-slate-900">{supplier.name}</h3>
                        {supplier.contactName && <p className="text-xs text-slate-500">{supplier.contactName}</p>}
                      </div>
                    </div>
                    {supplier.preferredVendor && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs border gap-1">
                        <Star className="w-3 h-3" />Preferred
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-slate-500">
                    {supplier.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />{supplier.phone}
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />{supplier.email}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>Lead time: {supplier.leadTimeDays != null ? `${supplier.leadTimeDays} days` : 'N/A'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
