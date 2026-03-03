import { useState } from "react";
import { useItems, useCreateItem } from "@/hooks/use-items";
import { useCategories, useLocations, useSuppliers } from "@/hooks/use-reference-data";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertItemSchema } from "@shared/schema";
import { Link } from "wouter";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: items, isLoading } = useItems({ 
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined 
  });
  
  const { data: categories } = useCategories();
  const { data: locations } = useLocations();
  const { data: suppliers } = useSuppliers();
  
  const createMutation = useCreateItem();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof insertItemSchema>>({
    resolver: zodResolver(insertItemSchema),
    defaultValues: {
      name: "", sku: "", unitOfMeasure: "EA", quantityOnHand: 0, minimumStock: 0, reorderPoint: 0, reorderQuantity: 0, unitCost: "0.00"
    }
  });

  function onSubmit(data: z.infer<typeof insertItemSchema>) {
    createMutation.mutate(data, {
      onSuccess: () => {
        setDialogOpen(false);
        form.reset();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 mt-1">Manage your materials, tools, and stock levels.</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20">
              <Plus className="w-5 h-5 mr-2" />
              Add New Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Inventory Item</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Item Name</FormLabel><FormControl><Input placeholder="e.g. Copper Wire 12 AWG" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="sku" render={({ field }) => (
                    <FormItem><FormLabel>SKU / Part Number</FormLabel><FormControl><Input placeholder="CW-12-AWG" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                    <FormItem><FormLabel>Unit of Measure</FormLabel><FormControl><Input placeholder="e.g. FT, EA, ROLL" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  
                  <FormField control={form.control} name="categoryId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="primaryLocationId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select Location" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {locations?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="quantityOnHand" render={({ field }) => (
                    <FormItem><FormLabel>Initial Quantity</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="unitCost" render={({ field }) => (
                    <FormItem><FormLabel>Unit Cost ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                    {createMutation.isPending ? "Creating..." : "Save Item"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="premium-card bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by SKU or Name..." 
              className="pl-9 bg-white border-slate-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-slate-600">SKU</TableHead>
                <TableHead className="font-semibold text-slate-600">Name</TableHead>
                <TableHead className="font-semibold text-slate-600">Category</TableHead>
                <TableHead className="font-semibold text-slate-600 text-right">Quantity</TableHead>
                <TableHead className="font-semibold text-slate-600">Status</TableHead>
                <TableHead className="font-semibold text-slate-600 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <TableRow key={i}>
                    <TableCell><div className="h-5 w-24 bg-slate-100 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-5 w-48 bg-slate-100 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-5 w-20 bg-slate-100 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-5 w-12 bg-slate-100 rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell><div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse"></div></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                    <PackageSearch className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-lg font-medium text-slate-900">No items found</p>
                    <p>Try adjusting your search or filters.</p>
                  </TableCell>
                </TableRow>
              ) : (
                items?.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="font-mono text-sm text-slate-500">{item.sku}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                    <TableCell className="text-slate-600">{item.category?.name || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {item.quantityOnHand} <span className="text-slate-400 font-normal text-sm">{item.unitOfMeasure}</span>
                    </TableCell>
                    <TableCell><ItemStatusBadge status={item.status} /></TableCell>
                    <TableCell className="text-right">
                      <Link href={`/inventory/${item.id}`} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100">
                        Details →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
