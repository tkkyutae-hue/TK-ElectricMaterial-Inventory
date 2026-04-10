import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUpdateProject, useDeleteProject } from "@/hooks/use-reference-data";
import { editSchema, cleanFormData, type EditFormData } from "./types";

export function EditProjectDialog({
  project, open, onClose, allProjects,
}: {
  project: any;
  open: boolean;
  onClose: () => void;
  allProjects: any[];
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "", customerName: "", ownerName: "",
      jobLocation: "", poNumber: "", status: "active",
      startDate: "", endDate: "", notes: "",
    },
  });

  useEffect(() => {
    if (open && project) {
      form.reset({
        name:         project.name         ?? "",
        customerName: project.customerName ?? "",
        ownerName:    project.ownerName    ?? "",
        jobLocation:  project.jobLocation  ?? "",
        poNumber:     project.poNumber     ?? "",
        status:       project.status       ?? "active",
        startDate:    project.startDate    ?? "",
        endDate:      project.endDate      ?? "",
        notes:        project.notes        ?? "",
      });
      setDeleteConfirm(false);
    }
  }, [open, project?.id]);

  function onSubmit(data: EditFormData) {
    updateMutation.mutate(
      { id: project.id, data: cleanFormData(data) },
      {
        onSuccess: () => { toast({ title: "Project updated" }); onClose(); },
        onError:   (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
      }
    );
  }

  function handleDelete() {
    deleteMutation.mutate(project.id, {
      onSuccess: () => { toast({ title: "Project deleted" }); onClose(); window.history.back(); },
      onError:   (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name *</FormLabel>
                <FormControl><Input {...field} data-testid="input-edit-project-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-customer-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ownerName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner / Manager</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="poNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>PO Number</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-po-number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-edit-project-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="jobLocation" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Location</FormLabel>
                <FormControl><Input {...field} data-testid="input-edit-job-location" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-between items-center pt-2">
              <div>
                {!deleteConfirm ? (
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteConfirm(true)}
                    data-testid="button-delete-project-init">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete Project
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-600 font-medium">Cannot be undone</span>
                    <Button type="button" size="sm" variant="destructive" onClick={handleDelete}
                      disabled={deleteMutation.isPending} data-testid="button-delete-project-confirm">
                      {deleteMutation.isPending ? "Deleting…" : "Confirm Delete"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setDeleteConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Cancel</Button>
                <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={updateMutation.isPending} data-testid="button-save-project">
                  <Save className="w-4 h-4 mr-1" />
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
