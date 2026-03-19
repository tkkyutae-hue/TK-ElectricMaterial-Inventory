import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { useRoute, useLocation } from "wouter";
import { useProjects, useProject, useUpdateProject, useDeleteProject } from "@/hooks/use-reference-data";
import { MovementForm } from "@/components/MovementForm";
import {
  ArrowLeft, MapPin, Calendar, Package, ArrowUpRight, ArrowDownRight,
  Users, Edit, Save, X, Trash2, Plus, Pencil, CheckCircle2, MinusCircle,
  LayoutList, Hash, TrendingUp, AlertCircle, Download, Clock, FileText,
  ListTodo, Eye, Filter, FileBarChart, ChevronRight, ChevronLeft, DollarSign,
  ChevronDown, Copy, FolderOpen, Boxes, Layers, Zap,
  Pipette, Wrench, LayoutGrid, Shield, Box, ToggleLeft, Cpu,
  Square, CheckSquare,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { QuickEntryInput } from "@/components/QuickEntryInput";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectScopeItem } from "@shared/schema";

const statusConfig: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

// ── Edit project schema ────────────────────────────────────────────────────────
const editSchema = z.object({
  name:         z.string().min(1, "Project name is required"),
  customerName: z.string().optional(),
  ownerName:    z.string().optional(),
  jobLocation:  z.string().optional(),
  poNumber:     z.string().optional(),
  status:       z.string().min(1),
  startDate:    z.string().optional(),
  endDate:      z.string().optional(),
  notes:        z.string().optional(),
});
type EditFormData = z.infer<typeof editSchema>;

function cleanFormData(data: EditFormData) {
  const clean: any = { ...data };
  const optionalFields: (keyof EditFormData)[] = [
    "customerName", "ownerName", "jobLocation", "poNumber", "startDate", "endDate", "notes",
  ];
  optionalFields.forEach(f => { if (clean[f] === "") clean[f] = null; });
  return clean;
}

// ── Scope Item schema ──────────────────────────────────────────────────────────
const scopeItemSchema = z.object({
  itemName:              z.string().min(1, "Item name is required"),
  unit:                  z.string().min(1, "Unit is required"),
  estimatedQty:          z.string().min(1, "Qty is required"),
  category:              z.string().optional(),
  remarks:               z.string().optional(),
  isActive:              z.boolean().default(true),
  linkedInventoryItemId: z.number().nullable().optional(),
  scopeType:             z.enum(["primary", "support"]).default("primary"),
  progressCountingMode:  z.enum(["exact", "family", "manual"]).default("exact"),
});
type ScopeItemFormData = z.infer<typeof scopeItemSchema>;

const COMMON_UNITS = ["LF", "EA", "FT", "SF", "CY", "LB", "HR", "DAY", "GAL", "TON"];

// Flexible word-order inventory search (same logic as NewReportTab)
function flexMatch(query: string, name: string): boolean {
  if (!query) return true;
  const nameLow  = name.toLowerCase();
  const words    = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  // All query words must appear in the item name (any order)
  return words.every(w => nameLow.includes(w));
}

// ── Edit Project Dialog ────────────────────────────────────────────────────────
function EditProjectDialog({
  project, open, onClose, allProjects,
}: {
  project: any; open: boolean; onClose: () => void; allProjects: any[];
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const [, navigate] = useLocation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const customerSuggestions = [...new Set(allProjects.map((p: any) => p.customerName).filter(Boolean))] as string[];
  const ownerSuggestions    = [...new Set(allProjects.map((p: any) => p.ownerName).filter(Boolean))] as string[];
  const locationSuggestions = [...new Set(allProjects.map((p: any) => p.jobLocation).filter(Boolean))] as string[];

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: project.name || "", customerName: project.customerName || "",
      ownerName: project.ownerName || "", jobLocation: project.jobLocation || "",
      poNumber: project.poNumber || "", status: project.status || "active",
      startDate: project.startDate || "", endDate: project.endDate || "", notes: project.notes || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: project.name || "", customerName: project.customerName || "",
        ownerName: project.ownerName || "", jobLocation: project.jobLocation || "",
        poNumber: project.poNumber || "", status: project.status || "active",
        startDate: project.startDate || "", endDate: project.endDate || "", notes: project.notes || "",
      });
      setShowDeleteConfirm(false);
    }
  }, [open, project.id]);

  async function onSubmit(data: EditFormData) {
    try {
      await updateMutation.mutateAsync({ id: project.id, code: project.code, ...cleanFormData(data) });
      toast({ title: "Project updated", description: `${data.name} has been saved.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(project.id);
      toast({ title: "Project deleted", description: `${project.name} has been removed.` });
      onClose();
      navigate("/projects");
    } catch (err: any) {
      toast({ title: "Cannot delete", description: err.message, variant: "destructive" });
      setShowDeleteConfirm(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl><Input {...field} data-testid="edit-project-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="edit-project-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="customerName" render={({ field }) => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <FormControl>
                  <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={customerSuggestions} placeholder="e.g. Apex Commercial Group" testId="edit-customer-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="ownerName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Owner</FormLabel>
                  <FormControl>
                    <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={ownerSuggestions} placeholder="e.g. John Kim" testId="edit-owner-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="poNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>PO Number</FormLabel>
                  <FormControl><Input placeholder="e.g. PO-2026-001" {...field} data-testid="edit-po-number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="jobLocation" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Location</FormLabel>
                <FormControl>
                  <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={locationSuggestions} placeholder="e.g. 123 Main St, Dallas TX" testId="edit-job-location" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="edit-start-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="edit-end-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-between items-center pt-2">
              <Button type="button" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                onClick={() => setShowDeleteConfirm(true)} disabled={updateMutation.isPending || deleteMutation.isPending} data-testid="button-delete-project">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending || deleteMutation.isPending}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={updateMutation.isPending || deleteMutation.isPending} data-testid="button-save-project">
                  <Save className="w-4 h-4 mr-1" />
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
            {showDeleteConfirm && (
              <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-900 mb-1">Delete "{project.name}"?</p>
                <p className="text-xs text-red-700 mb-3">This action cannot be undone. Projects with logged movements cannot be deleted — set status to "Cancelled" instead.</p>
                <div className="flex gap-2 justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteMutation.isPending}>Cancel</Button>
                  <Button type="button" size="sm" variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-project">
                    {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Category order + config ────────────────────────────────────────────────────
const CATEGORY_ORDER = [
  "Conduit", "Fittings & Connectors", "Cable Tray", "Cable / Wire",
  "Grounding", "Boxes", "Devices", "Equipment",
];

type CatConfig = {
  accent: string;
  iconBg: string;
  subtitle: string;
  subGroups?: { key: string; label: string }[];
};

const CATEGORY_CONFIG: Record<string, CatConfig> = {
  "Conduit": {
    accent: "#0891b2", iconBg: "#e0f7fa",
    subtitle: "선관 본체 · Flexible · EMT · Rigid",
    subGroups: [
      { key: "flexible", label: "Flexible (Liquidtight)" },
      { key: "emt",      label: "EMT" },
      { key: "rigid",    label: "Rigid" },
    ],
  },
  "Fittings & Connectors": {
    accent: "#4f6ef7", iconBg: "#eef2ff",
    subtitle: "Connector · Coupling · Strap · Bushing · Clamp",
    subGroups: [
      { key: "flexible", label: "Flexible Connectors" },
      { key: "emt",      label: "EMT Fittings" },
      { key: "rigid",    label: "Rigid Fittings" },
    ],
  },
  "Cable Tray": {
    accent: "#d97706", iconBg: "#fef3c7",
    subtitle: "Straight · Cover · Elbow · Vertical Out",
  },
  "Cable / Wire": {
    accent: "#7c3aed", iconBg: "#ede9fe",
    subtitle: "Multi-Conductor · Single Conductor",
  },
  "Grounding": {
    accent: "#16a34a", iconBg: "#dcfce7",
    subtitle: "Ground Wire · Bonding",
  },
  "Boxes": {
    accent: "#1d6ecc", iconBg: "#dbeafe",
    subtitle: "Junction Box · Pull Box · Panel",
  },
  "Devices": {
    accent: "#ea580c", iconBg: "#fff7ed",
    subtitle: "Receptacle · Switch · Lighting",
  },
  "Equipment": {
    accent: "#7e22ce", iconBg: "#f3e8ff",
    subtitle: "Transformer · Motor · Special",
  },
};

const CAT_ICONS: Record<string, React.ElementType> = {
  "Conduit":               Pipette,
  "Fittings & Connectors": Wrench,
  "Cable Tray":            LayoutGrid,
  "Cable / Wire":          Zap,
  "Grounding":             Shield,
  "Boxes":                 Box,
  "Devices":               ToggleLeft,
  "Equipment":             Cpu,
};

// Resolve which of the 8 display categories an item belongs to.
// Uses item name keywords first, then falls back to stored category string.
function resolveDisplayCategory(storedCat: string | null | undefined, itemName: string): string {
  const name = itemName.toLowerCase();
  const cat  = (storedCat ?? "").trim().toLowerCase();

  // Cable Tray
  if (name.includes("cable tray") || name.includes("checkered")) return "Cable Tray";

  // Grounding wire / rod / bar
  if (
    (name.includes("ground") && (name.includes("wire") || name.includes("rod") || name.includes("bar"))) ||
    cat === "grounding"
  ) return "Grounding";

  // Fittings / connectors
  const isFitting =
    name.includes("connector") ||
    name.includes("coupling") ||
    name.includes("strap") ||
    (name.includes("bushing") && !name.includes("ground")) ||
    name.includes("locknut") ||
    name.includes("pipe clamp") ||
    name.includes("conduit clamp") ||
    name.includes("lug") ||
    (name.includes("elbow") && !name.includes("cable tray"));
  if (isFitting) return "Fittings & Connectors";

  // Conduit runs
  const isConduit =
    (name.includes("conduit") && !name.includes("connector") && !name.includes("clamp")) ||
    name.includes("mc cable");
  if (isConduit) return "Conduit";

  // Wire / Cable runs
  const isCableOrWire =
    (name.includes("wire") && !name.includes("ground")) ||
    (name.includes("cable") && !name.includes("cable tray") && !name.includes("ground")) ||
    name.includes("thhn") ||
    name.includes("conductor") ||
    name.includes("(c+g)") ||
    name.includes("single wire") ||
    name.includes("multi-conductor");
  if (isCableOrWire) return "Cable / Wire";

  // Boxes / enclosures
  const isBox =
    name.includes("box") ||
    name.includes("enclosure") ||
    name.includes("pull box") ||
    name.includes("junction");
  if (isBox) return "Boxes";

  // Devices
  const isDevice =
    name.includes("receptacle") ||
    name.includes("switch") ||
    name.includes("outlet") ||
    name.includes("fixture") ||
    name.includes("exit sign") ||
    name.includes("duplex") ||
    name.includes("plug");
  if (isDevice) return "Devices";

  // Equipment
  const isEquipment =
    name.includes("transformer") ||
    name.includes("motor") ||
    name.includes("mcc") ||
    name.includes("panel") ||
    name.includes("vfd") ||
    name.includes("ups");
  if (isEquipment) return "Equipment";

  // Category-string fallback map
  const catMap: Record<string, string> = {
    "conduit":               "Conduit",
    "flexible":              "Conduit",
    "fittings":              "Fittings & Connectors",
    "fittings & connectors": "Fittings & Connectors",
    "supports / strut":      "Fittings & Connectors",
    "cable / wire":          "Cable / Wire",
    "cable tray":            "Cable Tray",
    "tray / covers":         "Cable Tray",
    "grounding":             "Grounding",
    "boxes":                 "Boxes",
    "boxes / devices":       "Boxes",
    "devices":               "Devices",
    "equipment / special":   "Equipment",
    "equipment":             "Equipment",
    "other":                 "Equipment",
    "emt support":           "Fittings & Connectors",
    "rigid support":         "Fittings & Connectors",
  };
  return catMap[cat] || "Equipment";
}

// Returns a sub-group key for Conduit / Fittings categories
function resolveSubGroup(displayCat: string, itemName: string): string | null {
  const name = itemName.toLowerCase();
  if (displayCat === "Conduit" || displayCat === "Fittings & Connectors") {
    if (
      name.includes("liquidtight") ||
      (name.includes("flexible") && (name.includes("conduit") || name.includes("connector")))
    ) return "flexible";
    if (name.includes("emt")) return "emt";
    if (name.includes("rigid")) return "rigid";
  }
  return null;
}

// Legacy shim — keeps inventory auto-fill working
function normalizeCategory(cat: string | null | undefined): string {
  return resolveDisplayCategory(cat, "");
}

type BundleTemplateItem = {
  itemName: string;
  unit: string;
  category: string;
  scopeType: "primary" | "support";
  searchWords: string[];
};

// EMT bundle template — size-aware:
//   Small (3/4", 1"): One-Hole Strap + EMT Unistrut Pipe Clamp (no elbow)
//   Large (≥1-1/4"): 90 Elbow replaces One-Hole Strap + universal Unistrut Pipe Clamp
function getEMTTemplate(size: string): BundleTemplateItem[] {
  const isSmall = size === '3/4"' || size === '1"';
  const base: BundleTemplateItem[] = [
    { itemName: "EMT Conduit",               unit: "FT", category: "Conduit",               scopeType: "primary", searchWords: ["emt", "conduit"] },
    { itemName: "EMT Compression Coupling",  unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "compression", "coupling"] },
    { itemName: "EMT Compression Connector", unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "compression", "connector"] },
    { itemName: "EMT Set Screw Coupling",    unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "set", "screw", "coupling"] },
    { itemName: "EMT Set Screw Connector",   unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "set", "screw", "connector"] },
  ];
  if (isSmall) {
    return [
      ...base,
      { itemName: "EMT One-Hole Strap",      unit: "EA", category: "EMT Support", scopeType: "support", searchWords: ["emt", "strap"] },
      { itemName: "EMT Unistrut Pipe Clamp", unit: "EA", category: "EMT Support", scopeType: "support", searchWords: ["emt", "unistrut", "pipe", "clamp"] },
    ];
  }
  return [
    ...base,
    { itemName: "EMT Elbow 90°",        unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "elbow", "90"] },
    { itemName: "Unistrut Pipe Clamp",  unit: "EA", category: "EMT Support",            scopeType: "support", searchWords: ["unistrut", "pipe", "clamp"] },
  ];
}

// Rigid bundle template — size-aware:
//   Small (3/4", 1"): One-Hole Strap + Rigid Unistrut Pipe Clamp (no elbow)
//   Large (≥1-1/4"): 90 Elbow replaces One-Hole Strap + universal Unistrut Pipe Clamp
//   No Set Screw items. Row 4 = Rigid Threaded Coupling (not Compression).
function getRigidTemplate(size: string): BundleTemplateItem[] {
  const isSmall = size === '3/4"' || size === '1"';
  const base: BundleTemplateItem[] = [
    { itemName: "Rigid Conduit",               unit: "FT", category: "Conduit",               scopeType: "primary", searchWords: ["rigid", "conduit"] },
    { itemName: "Rigid Compression Coupling",  unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["rigid", "compression", "coupling"] },
    { itemName: "Rigid Compression Connector", unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["rigid", "compression", "connector"] },
    { itemName: "Rigid Threaded Coupling",     unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["rigid", "threaded", "coupling"] },
  ];
  if (isSmall) {
    return [
      ...base,
      { itemName: "Rigid One-Hole Strap",      unit: "EA", category: "Rigid Support", scopeType: "support", searchWords: ["rigid", "strap"] },
      // DB has a typo: "Unisturt" not "Unistrut" — use "unist" prefix to match both spellings
      { itemName: "Rigid Unistrut Pipe Clamp", unit: "EA", category: "Rigid Support", scopeType: "support", searchWords: ["rigid", "unist", "pipe", "clamp"] },
    ];
  }
  return [
    ...base,
    { itemName: "Rigid Elbow 90°",     unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["rigid", "elbow", "90"] },
    { itemName: "Unistrut Pipe Clamp", unit: "EA", category: "Rigid Support",          scopeType: "support", searchWords: ["unistrut", "pipe", "clamp"] },
  ];
}

const BUNDLE_DEFINITIONS: Record<string, BundleTemplateItem[]> = {
  "Flexible Conduit Bundle": [
    { itemName: "Flexible Conduit",             unit: "FT", category: "Conduit",               scopeType: "primary", searchWords: ["flexible", "conduit"] },
    { itemName: "Flexible Connector Straight",  unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["flexible", "connector", "straight"] },
    { itemName: "Flexible Connector 90",        unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["flexible", "connector"] },
    { itemName: "Liquidtight Flexible Conduit", unit: "FT", category: "Conduit",               scopeType: "primary", searchWords: ["liquidtight", "conduit"] },
    { itemName: "Liquidtight Connector",        unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["liquidtight", "connector"] },
  ],
  "Cable Tray Bundle": [
    { itemName: "Cable Tray",               unit: "FT", category: "Cable Tray", scopeType: "primary", searchWords: ["cable", "tray"] },
    { itemName: "Cable Tray Coupler",       unit: "EA", category: "Cable Tray", scopeType: "support", searchWords: ["cable", "tray", "coupler"] },
    { itemName: "Cable Tray Elbow",         unit: "EA", category: "Cable Tray", scopeType: "support", searchWords: ["cable", "tray", "elbow"] },
    { itemName: "Cable Tray Cover",         unit: "FT", category: "Cable Tray", scopeType: "support", searchWords: ["cable", "tray", "cover"] },
    { itemName: "Cable Tray Support Hanger",unit: "EA", category: "Cable Tray", scopeType: "support", searchWords: ["cable", "tray", "support"] },
  ],
  "Box / Device Bundle": [
    { itemName: "4\" Square Box",      unit: "EA", category: "Boxes",   scopeType: "primary", searchWords: ["square", "box"] },
    { itemName: "4\" Square Box Cover", unit: "EA", category: "Boxes",   scopeType: "support", searchWords: ["square", "box", "cover"] },
    { itemName: "Device Box",           unit: "EA", category: "Boxes",   scopeType: "primary", searchWords: ["device", "box"] },
    { itemName: "Duplex Receptacle",    unit: "EA", category: "Devices", scopeType: "primary", searchWords: ["duplex", "receptacle"] },
    { itemName: "Single Pole Switch",   unit: "EA", category: "Devices", scopeType: "primary", searchWords: ["single", "pole", "switch"] },
    { itemName: "Cover Plate",          unit: "EA", category: "Devices", scopeType: "support", searchWords: ["cover", "plate"] },
  ],
  "Grounding Bundle": [
    { itemName: "Ground Rod",       unit: "EA", category: "Grounding", scopeType: "primary", searchWords: ["ground", "rod"] },
    { itemName: "Ground Rod Clamp", unit: "EA", category: "Grounding", scopeType: "support", searchWords: ["ground", "rod", "clamp"] },
    { itemName: "Grounding Wire",   unit: "FT", category: "Grounding", scopeType: "primary", searchWords: ["grounding", "wire"] },
    { itemName: "Grounding Bushing",unit: "EA", category: "Grounding", scopeType: "support", searchWords: ["grounding", "bushing"] },
    { itemName: "Grounding Lug",    unit: "EA", category: "Grounding", scopeType: "support", searchWords: ["grounding", "lug"] },
  ],
};

// ── Pending row type for inline add ───────────────────────────────────────────
type PendingRow = {
  localId: string;
  itemName: string;
  unit: string;
  estimatedQty: string;
  category: string;
  linkedInventoryItemId: number | null;
  remarks: string;
  scopeType: "primary" | "support";
};

type BundleRow = {
  localId: string;
  itemName: string;
  unit: string;
  estimatedQty: string;
  category: string;
  scopeType: "primary" | "support";
  checked: boolean;
  linkedInventoryItemId?: number | null;
};

function newBundleRow(): BundleRow {
  return {
    localId: Math.random().toString(36).slice(2),
    itemName: "", unit: "EA", estimatedQty: "",
    category: "Other", scopeType: "primary",
    checked: true, linkedInventoryItemId: null,
  };
}

// Size lists per bundle type — 1/2" excluded from EMT and Rigid per spec
const BUNDLE_SIZES: Record<string, string[]> = {
  "EMT Conduit Bundle":      ["3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","3-1/2\"","4\"","6\""],
  "Rigid Conduit Bundle":    ["3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","3-1/2\"","4\"","6\""],
  "Flexible Conduit Bundle": ["3/8\"","1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\""],
  "Cable Tray Bundle":       ["4\"","6\"","9\"","12\"","18\"","24\"","30\"","36\""],
  "Box / Device Bundle":     ["1G","2G","4\" Square","4-11/16\""],
  "Grounding Bundle":        ["#6","#4","#2","#1/0","#2/0","3/4\" Rod","5/8\" Rod"],
};

function newPendingRow(): PendingRow {
  return {
    localId: Math.random().toString(36).slice(2),
    itemName: "", unit: "", estimatedQty: "",
    category: "", linkedInventoryItemId: null, remarks: "",
    scopeType: "primary",
  };
}

// ── Scope Type Chip ── Only rendered for non-primary items ────────────────────
function ScopeTypeChip({ scopeType }: { scopeType: string | null | undefined }) {
  if (!scopeType || scopeType === "primary") return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-400 border border-slate-200 whitespace-nowrap ml-1.5">
      sup
    </span>
  );
}

// ── Inline scope row ──────────────────────────────────────────────────────────
function InlineScopeRow({
  row, invItems, onChange, onRemove, rowIndex,
}: {
  row: PendingRow;
  invItems: any[];
  onChange: (updated: PendingRow) => void;
  onRemove: () => void;
  rowIndex: number;
}) {
  const [invSearch, setInvSearch] = useState(
    row.linkedInventoryItemId
      ? (invItems.find(it => it.id === row.linkedInventoryItemId)?.name ?? row.itemName)
      : row.itemName
  );
  const [invOpen, setInvOpen] = useState(false);

  const filtered = invItems
    .filter(it => flexMatch(invSearch, it.name))
    .slice(0, 12);

  function selectInv(it: any) {
    setInvSearch(it.name);
    setInvOpen(false);
    onChange({
      ...row,
      itemName: it.name,
      unit: it.unitOfMeasure ?? row.unit,
      linkedInventoryItemId: it.id,
      category: it.subcategory ?? row.category,
    });
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3" data-testid={`inline-scope-row-${rowIndex}`}>
      {/* Row 1: main fields */}
      <div className="flex items-start gap-2">
        {/* Item / inventory search */}
        <div className="flex-1 min-w-0 space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Item / Description *</label>
          <div className="relative">
            <Input
              value={invSearch}
              placeholder="Search inventory or enter name…"
              onChange={(e) => {
                const val = e.target.value;
                setInvSearch(val);
                setInvOpen(true);
                if (row.linkedInventoryItemId && val !== invItems.find(it => it.id === row.linkedInventoryItemId)?.name) {
                  onChange({ ...row, itemName: val, linkedInventoryItemId: null });
                } else {
                  onChange({ ...row, itemName: val });
                }
              }}
              onFocus={() => setInvOpen(true)}
              onBlur={() => setTimeout(() => setInvOpen(false), 150)}
              className={`h-8 text-sm ${row.linkedInventoryItemId ? "border-emerald-300 bg-emerald-50/60" : ""}`}
              data-testid={`inline-scope-name-${rowIndex}`}
            />
            {row.linkedInventoryItemId && (
              <button type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => { setInvSearch(""); onChange({ ...row, itemName: "", linkedInventoryItemId: null }); }}>
                <X className="w-3 h-3" />
              </button>
            )}
            {invOpen && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                {filtered.map(it => (
                  <button key={it.id} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => selectInv(it)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors ${row.linkedInventoryItemId === it.id ? "bg-emerald-50 text-emerald-800 font-semibold" : "text-slate-700"}`}>
                    <span className="truncate">{it.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{it.unitOfMeasure ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {row.linkedInventoryItemId && (
            <p className="text-[10px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Inventory item linked
            </p>
          )}
        </div>

        {/* Unit */}
        <div className="w-20 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Unit *</label>
          <Input
            value={row.unit}
            placeholder="EA"
            onChange={e => onChange({ ...row, unit: e.target.value })}
            className="h-8 text-sm"
            list={`units-list-${rowIndex}`}
            data-testid={`inline-scope-unit-${rowIndex}`}
          />
          <datalist id={`units-list-${rowIndex}`}>
            {COMMON_UNITS.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>

        {/* Est. Qty */}
        <div className="w-24 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Est. Qty *</label>
          <Input
            type="number"
            min="0"
            step="any"
            value={row.estimatedQty}
            placeholder="0"
            onChange={e => onChange({ ...row, estimatedQty: e.target.value })}
            className="h-8 text-sm"
            data-testid={`inline-scope-qty-${rowIndex}`}
          />
        </div>

        {/* Category */}
        <div className="w-32 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Category</label>
          <Input
            value={row.category}
            placeholder="e.g. Conduit"
            onChange={e => onChange({ ...row, category: e.target.value })}
            className="h-8 text-sm"
            list={`cat-list-${rowIndex}`}
            data-testid={`inline-scope-category-${rowIndex}`}
          />
          <datalist id={`cat-list-${rowIndex}`}>
            {CATEGORY_ORDER.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        {/* Scope Type */}
        <div className="w-28 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Scope Type</label>
          <select
            value={row.scopeType}
            onChange={e => onChange({ ...row, scopeType: e.target.value as "primary" | "support" })}
            className="h-8 w-full text-xs border border-slate-200 rounded-md px-2 bg-white text-slate-700"
            data-testid={`inline-scope-type-${rowIndex}`}
          >
            <option value="primary">Primary</option>
            <option value="support">Support</option>
          </select>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={onRemove}
          className="mt-6 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          data-testid={`inline-scope-remove-${rowIndex}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Row 2: remarks */}
      <Input
        value={row.remarks}
        placeholder="Remarks (optional)"
        onChange={e => onChange({ ...row, remarks: e.target.value })}
        className="h-7 text-xs text-slate-500 bg-white"
        data-testid={`inline-scope-remarks-${rowIndex}`}
      />
    </div>
  );
}

// ── Bundle scope row (searchable, used in BundleSelector configure phase) ──────
function BundleScopeRow({
  row, invItems, onChange, onRemove, rowIndex, bundleType, bundleSize, isDuplicate,
}: {
  row: BundleRow;
  invItems: any[];
  onChange: (updated: BundleRow) => void;
  onRemove: () => void;
  rowIndex: number;
  bundleType?: string;
  bundleSize?: string;
  isDuplicate?: boolean;
}) {
  const [invSearch, setInvSearch] = useState(
    row.linkedInventoryItemId
      ? (invItems.find(it => it.id === row.linkedInventoryItemId)?.name ?? row.itemName)
      : row.itemName
  );
  const [invOpen, setInvOpen] = useState(false);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display text when row changes externally (size change / auto-match)
  const prevLinkedId = useRef(row.linkedInventoryItemId);
  const prevItemName = useRef(row.itemName);
  useEffect(() => {
    const idChanged = row.linkedInventoryItemId !== prevLinkedId.current;
    const nameChanged = row.itemName !== prevItemName.current;
    if (idChanged) {
      if (row.linkedInventoryItemId) {
        const item = invItems.find(it => it.id === row.linkedInventoryItemId);
        if (item) setInvSearch(item.name);
      } else {
        setInvSearch(row.itemName);
      }
      prevLinkedId.current = row.linkedInventoryItemId;
    } else if (nameChanged && !row.linkedInventoryItemId) {
      setInvSearch(row.itemName);
    }
    prevItemName.current = row.itemName;
  }, [row.itemName, row.linkedInventoryItemId, invItems]);

  // Bundle-type-aware + search filtering
  const filtered = useMemo(() => {
    const query = invSearch.trim();
    let pool = invItems;

    // When no query, pre-filter to bundle-relevant items
    if (!query && bundleType) {
      const bt = bundleType.toLowerCase();
      pool = invItems.filter(it => {
        const n = it.name.toLowerCase();
        if (bt.includes("emt conduit")) return n.includes("emt");
        if (bt.includes("rigid conduit")) return n.includes("rigid") && !n.includes("flexible") && !n.includes("liquidtight");
        if (bt.includes("flexible conduit")) return n.includes("flexible") || n.includes("liquidtight");
        if (bt.includes("cable tray")) return n.includes("cable tray") || n.includes("tray");
        if (bt.includes("box") || bt.includes("device")) {
          return n.includes("box") || n.includes("receptacle") || n.includes("switch") || n.includes("plate") || n.includes("duplex") || n.includes("device");
        }
        if (bt.includes("grounding")) return n.includes("ground");
        return true;
      });
    }

    if (!query) return pool.slice(0, 10);
    return pool.filter(it => flexMatch(query, it.name)).slice(0, 10);
  }, [invSearch, invItems, bundleType]);

  function openDrop() {
    if (!row.checked) return;
    if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
    setInvOpen(true);
  }

  function selectInv(it: any) {
    setInvSearch(it.name);
    setInvOpen(false);
    // Keep the template category — do NOT override it with inventory subcategory
    onChange({
      ...row,
      itemName: it.name,
      unit: it.unitOfMeasure ?? row.unit,
      linkedInventoryItemId: it.id,
    });
  }

  // Portal-based dropdown — renders to document.body to escape overflow clipping
  const dropdownPortal = invOpen && row.checked && filtered.length > 0 && dropRect
    ? createPortal(
        <div style={{
          position: "fixed",
          top: dropRect.bottom + 2,
          left: dropRect.left,
          width: dropRect.width,
          zIndex: 9999,
        }} className="bg-white border border-slate-200 rounded-lg shadow-2xl max-h-44 overflow-y-auto">
          {filtered.map(it => (
            <button key={it.id} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectInv(it)}
              className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 hover:bg-slate-50 ${row.linkedInventoryItemId === it.id ? "bg-emerald-50 text-emerald-800 font-semibold" : "text-slate-700"}`}>
              <span className="truncate">{it.name}</span>
              <span className="text-[10px] text-slate-400 shrink-0">{it.unitOfMeasure}</span>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <Fragment>
      <tr className={`transition-colors border-t border-slate-100 ${!row.checked ? "opacity-40 bg-slate-50/50" : isDuplicate ? "bg-red-50 border-red-200" : "bg-white"}`}
        data-testid={`bundle-row-${rowIndex}`}>
        {/* Checkbox */}
        <td className="px-3 py-2">
          <input type="checkbox" checked={row.checked}
            onChange={e => onChange({ ...row, checked: e.target.checked })}
            className="rounded" data-testid={`bundle-row-check-${rowIndex}`} />
        </td>
        {/* Item / inventory search */}
        <td className="px-2 py-2">
          <div className="relative">
            <Input
              ref={inputRef}
              value={invSearch}
              placeholder="Search inventory…"
              disabled={!row.checked}
              onChange={e => {
                const val = e.target.value;
                setInvSearch(val);
                if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
                setInvOpen(true);
                if (row.linkedInventoryItemId && val !== invItems.find(it => it.id === row.linkedInventoryItemId)?.name) {
                  onChange({ ...row, itemName: val, linkedInventoryItemId: null });
                } else {
                  onChange({ ...row, itemName: val });
                }
              }}
              onFocus={openDrop}
              onBlur={() => setTimeout(() => setInvOpen(false), 200)}
              className={`h-7 text-xs ${row.linkedInventoryItemId ? "border-emerald-300 bg-emerald-50/60" : ""}`}
              data-testid={`bundle-row-name-${rowIndex}`}
            />
            {row.checked && row.linkedInventoryItemId && (
              <button type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => { setInvSearch(""); onChange({ ...row, itemName: "", linkedInventoryItemId: null }); }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {row.checked && row.linkedInventoryItemId && (
            <p className="text-[9px] text-emerald-600 mt-0.5 flex items-center gap-0.5">
              <CheckCircle2 className="w-2 h-2" /> linked
            </p>
          )}
        </td>
        {/* Unit */}
        <td className="px-2 py-2 w-14">
          <Input value={row.unit} disabled={!row.checked}
            onChange={e => onChange({ ...row, unit: e.target.value })}
            className="h-7 text-xs w-14" data-testid={`bundle-row-unit-${rowIndex}`} />
        </td>
        {/* Est. Qty */}
        <td className="px-2 py-2 w-20">
          <Input type="number" min="0" step="any" value={row.estimatedQty} placeholder="0"
            disabled={!row.checked}
            onChange={e => onChange({ ...row, estimatedQty: e.target.value })}
            className="h-7 text-xs w-20" data-testid={`bundle-row-qty-${rowIndex}`} />
        </td>
        {/* Category */}
        <td className="px-2 py-2 w-28">
          <Input value={row.category} disabled={!row.checked}
            onChange={e => onChange({ ...row, category: e.target.value })}
            className="h-7 text-xs w-28"
            list={`bundle-cat-list-${rowIndex}`}
            data-testid={`bundle-row-cat-${rowIndex}`} />
          <datalist id={`bundle-cat-list-${rowIndex}`}>
            {CATEGORY_ORDER.map(c => <option key={c} value={c} />)}
            <option value="EMT Support" />
            <option value="Rigid Support" />
          </datalist>
        </td>
        {/* Scope type */}
        <td className="px-2 py-2 w-20">
          <select value={row.scopeType} disabled={!row.checked}
            onChange={e => onChange({ ...row, scopeType: e.target.value as "primary" | "support" })}
            className="h-7 text-[11px] border border-slate-200 rounded px-1 bg-white w-20"
            data-testid={`bundle-row-type-${rowIndex}`}>
            <option value="primary">Primary</option>
            <option value="support">Support</option>
          </select>
        </td>
        {/* Delete */}
        <td className="px-2 py-2 w-8">
          <button type="button" onClick={onRemove}
            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            data-testid={`bundle-row-delete-${rowIndex}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
      {dropdownPortal}
    </Fragment>
  );
}

// ── Add / Edit Scope Item Dialog ──────────────────────────────────────────────
function ScopeItemDialog({
  projectId, item, open, onClose,
}: {
  projectId: number;
  item: ProjectScopeItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const isEdit = !!item;
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allInventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });
  const [invSearch, setInvSearch] = useState("");
  const [invOpen, setInvOpen] = useState(false);
  const [linkedInvId, setLinkedInvId] = useState<number | null>(null);

  const filteredInvItems = allInventoryItems.filter(it => flexMatch(invSearch, it.name)).slice(0, 12);
  const linkedInvName = allInventoryItems.find(it => it.id === linkedInvId)?.name ?? "";

  const form = useForm<ScopeItemFormData>({
    resolver: zodResolver(scopeItemSchema),
    defaultValues: {
      itemName: "", unit: "", estimatedQty: "", category: "", remarks: "",
      isActive: true, linkedInventoryItemId: null,
      scopeType: "primary", progressCountingMode: "exact",
    },
  });

  useEffect(() => {
    if (open) {
      if (isEdit && item) {
        const lid = (item as any)?.linkedInventoryItemId ?? null;
        setLinkedInvId(lid);
        setInvSearch(lid ? (allInventoryItems.find(it => it.id === lid)?.name ?? "") : "");
        form.reset({
          itemName: item.itemName ?? "",
          unit: item.unit ?? "",
          estimatedQty: item.estimatedQty ? String(item.estimatedQty) : "",
          category: item.category ?? "",
          remarks: item.remarks ?? "",
          isActive: item.isActive ?? true,
          linkedInventoryItemId: lid,
          scopeType: ((item as any).scopeType as "primary" | "support") ?? "primary",
          progressCountingMode: ((item as any).progressCountingMode as "exact" | "family" | "manual") ?? "exact",
        });
      } else {
        setLinkedInvId(null);
        setInvSearch("");
        form.reset({
          itemName: "", unit: "", estimatedQty: "", category: "", remarks: "",
          isActive: true, linkedInventoryItemId: null,
          scopeType: "primary", progressCountingMode: "exact",
        });
      }
    }
  }, [open, item?.id]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? apiRequest("PATCH", `/api/scope-items/${item!.id}`, data)
        : apiRequest("POST", `/api/projects/${projectId}/scope-items`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: isEdit ? "Scope item updated" : "Scope item added" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  function onSubmit(data: ScopeItemFormData) {
    saveMutation.mutate({ ...data, estimatedQty: String(data.estimatedQty), linkedInventoryItemId: linkedInvId });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Scope Item" : "Add Scope Item"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="itemName" render={({ field }) => (
              <FormItem>
                <FormLabel>Item Name *</FormLabel>
                <FormControl><Input {...field} data-testid="input-scope-item-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit *</FormLabel>
                  <FormControl><Input {...field} list="dlg-units-list" data-testid="select-scope-unit" /></FormControl>
                  <datalist id="dlg-units-list">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estimatedQty" render={({ field }) => (
                <FormItem>
                  <FormLabel>Est. Qty *</FormLabel>
                  <FormControl><Input type="number" min="0" step="any" placeholder="0" {...field} data-testid="input-scope-qty" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Conduit" {...field} list="dlg-cat-list" data-testid="input-scope-category" /></FormControl>
                  <datalist id="dlg-cat-list">{CATEGORY_ORDER.map(c => <option key={c} value={c} />)}</datalist>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="scopeType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-scope-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="progressCountingMode" render={({ field }) => (
              <FormItem>
                <FormLabel>Progress Counting Mode</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger data-testid="select-scope-counting-mode"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="exact">Exact Match Only</SelectItem>
                    <SelectItem value="family">Family Match (same category)</SelectItem>
                    <SelectItem value="manual">Manual Mapping</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Inventory Item Link <span className="text-slate-400 font-normal text-xs">(optional)</span>
              </label>
              <div className="relative">
                <Input
                  placeholder="Search inventory items to link…"
                  value={invSearch}
                  data-testid="input-scope-inv-link"
                  onChange={(e) => { setInvSearch(e.target.value); setInvOpen(true); if (!e.target.value) setLinkedInvId(null); }}
                  onFocus={() => setInvOpen(true)}
                  onBlur={() => setTimeout(() => setInvOpen(false), 150)}
                  className={linkedInvId ? "border-emerald-300 bg-emerald-50" : ""}
                />
                {linkedInvId && (
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => { setLinkedInvId(null); setInvSearch(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {invOpen && filteredInvItems.length > 0 && (
                  <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredInvItems.map(it => (
                      <button key={it.id} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setLinkedInvId(it.id); setInvSearch(it.name); setInvOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-2 ${linkedInvId === it.id ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-700"}`}>
                        <span className="truncate">{it.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{it.unitOfMeasure ?? ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {linkedInvId && <p className="text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Linked: {linkedInvName}</p>}
            </div>
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" placeholder="Any notes…" {...field} data-testid="input-scope-remarks" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {isEdit && (
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "true")} value={String(field.value)}>
                    <FormControl><SelectTrigger data-testid="select-scope-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
              <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={saveMutation.isPending} data-testid="button-save-scope-item">
                <Save className="w-4 h-4 mr-1" />
                {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Inline Variant Area ────────────────────────────────────────────────────────
function VariantArea({
  item, invItems, onSave, onClose,
}: {
  item: ProjectScopeItem;
  invItems: any[];
  onSave: (ids: number[]) => void;
  onClose: () => void;
}) {
  const existing: number[] = (item as any).acceptedVariants ?? [];
  const [selected, setSelected] = useState<number[]>(existing);
  const [search, setSearch] = useState("");

  const filtered = invItems.filter(it => flexMatch(search, it.name)).slice(0, 15);
  const selectedItems = invItems.filter(it => selected.includes(it.id));

  function toggle(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <tr>
      <td colSpan={6} className="px-5 pb-4 pt-0">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-800">Accepted Variants — "{item.itemName}"</p>
              <p className="text-[10px] text-indigo-500 mt-0.5">Inventory items accepted as substitutes for this scope item</p>
            </div>
            <button type="button" onClick={onClose} className="text-indigo-400 hover:text-indigo-600 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {selectedItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedItems.map(it => (
                <span key={it.id} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 border border-indigo-300 text-indigo-800 text-xs rounded-full">
                  {it.name}
                  <button type="button" onClick={() => toggle(it.id)} className="text-indigo-400 hover:text-indigo-700 ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search inventory items to add as variants…"
            className="h-8 text-xs"
            data-testid={`variant-search-${item.id}`}
          />
          {search && (
            <div className="bg-white border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
              {filtered.length === 0
                ? <p className="text-xs text-slate-400 px-3 py-2 italic">No matches</p>
                : filtered.map(it => (
                  <button key={it.id} type="button" onClick={() => toggle(it.id)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors ${selected.includes(it.id) ? "bg-indigo-50 text-indigo-800 font-medium" : "text-slate-700"}`}
                    data-testid={`variant-item-${it.id}`}>
                    <span className="truncate">{it.name}</span>
                    {selected.includes(it.id) && <CheckCircle2 className="w-3 h-3 text-indigo-600 shrink-0" />}
                  </button>
                ))
              }
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-indigo-600">{selected.length} variant{selected.length !== 1 ? "s" : ""} selected</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onClose} className="h-7 text-xs">Cancel</Button>
              <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => onSave(selected)} data-testid={`button-save-variants-${item.id}`}>
                Save Variants
              </Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Bundle Selector ────────────────────────────────────────────────────────────
function BundleSelector({
  onSave, onClose, invItems,
}: {
  onSave: (rows: Omit<BundleRow, "localId">[]) => void;
  onClose: () => void;
  invItems: any[];
}) {
  const [phase, setPhase] = useState<"select" | "configure">("select");
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [bundleRows, setBundleRows] = useState<BundleRow[]>([]);

  const availableSizes = selectedBundle ? (BUNDLE_SIZES[selectedBundle] ?? []) : [];

  // Normalize size strings so hyphen and space formats compare equal:
  // "2-1/2" ↔ "2 1/2", "3-1/2" ↔ "3 1/2", "1-1/4" ↔ "1 1/4"
  // Some inventory items use spaces (e.g. "2 1/2\" Rigid Elbow 90°") while
  // BUNDLE_SIZES use hyphens (e.g. "2-1/2\"") — this reconciles both.
  function normSize(s: string): string {
    return s.replace(/(\d)-(\d)/g, "$1 $2");
  }

  // Resolve one inventory match for a bundle template item + selected size.
  // Size must appear at the START of the item name (after stripping quotes/hash)
  // so "4" cannot accidentally match "1-1/4" items.
  function resolveInvMatch(searchWords: string[], sizeNorm: string) {
    return sizeNorm
      ? invItems.find(inv => {
          const n = inv.name.toLowerCase();
          const nNorm = normSize(n.replace(/['"#]/g, "").trim());
          const normSz = normSize(sizeNorm);
          const sizeMatch = nNorm.startsWith(normSz + " ") || nNorm === normSz;
          return sizeMatch && searchWords.every(w => n.includes(w));
        })
      : invItems.find(inv => {
          const n = inv.name.toLowerCase();
          return searchWords.every(w => n.includes(w));
        });
  }

  // Fully regenerate bundle rows from template + selected size (always fresh, no stale state)
  function buildRows(bundleName: string, size: string): BundleRow[] {
    // EMT and Rigid use size-aware template functions (clamp name changes per size)
    let items: BundleTemplateItem[];
    if (bundleName === "EMT Conduit Bundle") {
      items = getEMTTemplate(size);
    } else if (bundleName === "Rigid Conduit Bundle") {
      items = getRigidTemplate(size);
    } else {
      items = BUNDLE_DEFINITIONS[bundleName] ?? [];
    }
    const sizeNorm = size ? size.toLowerCase().replace(/['"#]/g, "").trim() : "";
    return items.map(it => {
      const match = resolveInvMatch(it.searchWords, sizeNorm);
      return {
        localId: Math.random().toString(36).slice(2),
        itemName: match ? match.name : it.itemName,
        unit: match ? (match.unitOfMeasure || it.unit) : it.unit,
        estimatedQty: "",
        category: it.category,
        scopeType: it.scopeType,
        checked: true,
        linkedInventoryItemId: match ? match.id : null,
      };
    });
  }

  function pickBundle(name: string) {
    const defaultSize = BUNDLE_SIZES[name]?.[0] ?? "";
    setSelectedBundle(name);
    setSelectedSize(defaultSize);
    setBundleRows(buildRows(name, defaultSize));
    setPhase("configure");
  }

  // Size change always does a full row regeneration — no stale names/units/categories
  function handleSizeChange(size: string) {
    setSelectedSize(size);
    if (!selectedBundle) return;
    setBundleRows(buildRows(selectedBundle, size));
  }

  function addManualRow() {
    setBundleRows(prev => [...prev, newBundleRow()]);
  }

  function updateRow(localId: string, updated: BundleRow) {
    setBundleRows(prev => prev.map(r => r.localId === localId ? updated : r));
  }

  function removeRow(localId: string) {
    setBundleRows(prev => prev.filter(r => r.localId !== localId));
  }

  // Find duplicate linked inventory IDs among checked rows
  const duplicateInvIds: Set<number> = useMemo(() => {
    const checked = bundleRows.filter(r => r.checked && r.linkedInventoryItemId);
    const idCounts = new Map<number, number>();
    checked.forEach(r => {
      const id = r.linkedInventoryItemId!;
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    });
    const dups = new Set<number>();
    idCounts.forEach((count, id) => { if (count > 1) dups.add(id); });
    return dups;
  }, [bundleRows]);

  const hasDuplicates = duplicateInvIds.size > 0;

  function handleSave() {
    if (hasDuplicates) return;
    const toSave = bundleRows
      .filter(r => r.checked && r.itemName.trim())
      .map(({ localId: _l, checked: _c, ...rest }) => rest);
    onSave(toSave);
  }

  const checkedCount = bundleRows.filter(r => r.checked && r.itemName.trim()).length;

  if (phase === "select") {
    return (
      <div className="premium-card bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-brand-50/40">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Boxes className="w-4 h-4 text-brand-600" /> Add by Bundle
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Select a bundle template — then pick a size and confirm items</p>
          </div>
          <Button size="sm" variant="outline" onClick={onClose} data-testid="button-cancel-bundle">Cancel</Button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { name: "EMT Conduit Bundle",      count: 7 },
            { name: "Rigid Conduit Bundle",    count: 6 },
            { name: "Flexible Conduit Bundle", count: (BUNDLE_DEFINITIONS["Flexible Conduit Bundle"] ?? []).length },
            { name: "Cable Tray Bundle",        count: (BUNDLE_DEFINITIONS["Cable Tray Bundle"] ?? []).length },
            { name: "Box / Device Bundle",     count: (BUNDLE_DEFINITIONS["Box / Device Bundle"] ?? []).length },
            { name: "Grounding Bundle",        count: (BUNDLE_DEFINITIONS["Grounding Bundle"] ?? []).length },
          ].map(({ name, count }) => (
            <button
              key={name} type="button"
              onClick={() => pickBundle(name)}
              className="text-left p-4 border border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 transition-all group"
              data-testid={`bundle-card-${name.replace(/\s+/g, "-")}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-lg group-hover:bg-brand-100 transition-colors shrink-0">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 leading-snug">{name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{count} items · click to configure</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card bg-white overflow-hidden">
      {/* Configure header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-brand-50/40">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" /> {selectedBundle}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Check items to include · search inventory · fill quantities</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPhase("select")} className="text-xs">← Back</Button>
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">Cancel</Button>
        </div>
      </div>

      {/* Size selector bar */}
      {availableSizes.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 shrink-0">Size</span>
          <div className="flex flex-wrap gap-1.5">
            {availableSizes.map(sz => (
              <button
                key={sz} type="button"
                onClick={() => handleSizeChange(sz)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  selectedSize === sz
                    ? "bg-brand-700 text-white border-brand-700"
                    : "border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50"
                }`}
                data-testid={`bundle-size-${sz.replace(/[^a-z0-9]/gi, "-")}`}
              >
                {sz}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-400 ml-1">Applies to item names automatically</span>
        </div>
      )}

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-3 py-2.5 w-8"></th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs">Item (search inventory)</th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-14">Unit</th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-20">Est. Qty</th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-28">Category</th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-20">Type</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {bundleRows.map((row, i) => (
              <BundleScopeRow
                key={row.localId}
                row={row}
                invItems={invItems}
                rowIndex={i}
                onChange={updated => updateRow(row.localId, updated)}
                onRemove={() => removeRow(row.localId)}
                bundleType={selectedBundle ?? undefined}
                bundleSize={selectedSize}
                isDuplicate={!!(row.linkedInventoryItemId && duplicateInvIds.has(row.linkedInventoryItemId))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Duplicate warning */}
      {hasDuplicates && (
        <div className="px-5 py-2.5 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Duplicate inventory items detected — highlighted rows share the same item. Remove duplicates before saving.
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{checkedCount} item{checkedCount !== 1 ? "s" : ""} will be added</span>
          <Button size="sm" variant="outline" className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50" onClick={addManualRow}
            data-testid="button-bundle-add-row">
            <Plus className="w-3 h-3 mr-1" /> Add Row
          </Button>
        </div>
        <Button className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSave}
          disabled={checkedCount === 0 || hasDuplicates} data-testid="button-save-bundle">
          <Save className="w-4 h-4 mr-1.5" />
          Add {checkedCount} Item{checkedCount !== 1 ? "s" : ""} to Scope
        </Button>
      </div>
    </div>
  );
}

// ── Scope Items Tab ────────────────────────────────────────────────────────────
function ScopeItemsTab({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  type AddMode = "none" | "multiple" | "bundle";
  const [dialogItem, setDialogItem] = useState<ProjectScopeItem | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectScopeItem | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [variantOpen, setVariantOpen] = useState<number | null>(null);
  const [movingItem, setMovingItem] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [undoSnackbar, setUndoSnackbar] = useState<{ message: string; onUndo: () => void } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: scopeItems = [], isLoading } = useQuery<ProjectScopeItem[]>({
    queryKey: ["/api/projects", projectId, "scope-items"],
    queryFn: () => fetch(`/api/projects/${projectId}/scope-items`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: allInvItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/scope-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: "Scope item deleted" });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/scope-items/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const totalItems = scopeItems.length;
  const totalQty = scopeItems.reduce((s, i) => s + parseFloat(String(i.estimatedQty || 0)), 0);
  const primaryCount = scopeItems.filter(i => !((i as any).scopeType) || (i as any).scopeType === "primary").length;

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectScopeItem[]>();
    for (const item of scopeItems) {
      const cat = resolveDisplayCategory(item.category, item.itemName);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    for (const [, items] of map) items.sort((a, b) => {
      const aType = (a as any).scopeType ?? "primary";
      const bType = (b as any).scopeType ?? "primary";
      if (aType !== bType) return aType === "primary" ? -1 : 1;
      return a.itemName.localeCompare(b.itemName);
    });
    const result: { cat: string; items: ProjectScopeItem[] }[] = [];
    for (const cat of CATEGORY_ORDER) { if (map.has(cat)) result.push({ cat, items: map.get(cat)! }); }
    for (const [cat, items] of map) { if (!CATEGORY_ORDER.includes(cat)) result.push({ cat, items }); }
    return result;
  }, [scopeItems]);

  function toggleCat(cat: string) {
    setCollapsedCats(prev => { const next = new Set(prev); if (next.has(cat)) next.delete(cat); else next.add(cat); return next; });
  }

  function addRow() { setPendingRows(prev => [...prev, newPendingRow()]); }
  function updateRow(localId: string, updated: PendingRow) { setPendingRows(prev => prev.map(r => r.localId === localId ? updated : r)); }
  function removeRow(localId: string) { setPendingRows(prev => prev.filter(r => r.localId !== localId)); }

  async function saveMultiple() {
    const validRows = pendingRows.filter(r => r.itemName.trim() && r.unit.trim() && r.estimatedQty.trim());
    if (validRows.length === 0) {
      toast({ title: "Nothing to save", description: "Fill in at least Item Name, Unit, and Est. Qty.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all(validRows.map(row =>
        apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
          itemName: row.itemName.trim(), unit: row.unit.trim(),
          estimatedQty: row.estimatedQty,
          category: row.category.trim() || null,
          remarks: row.remarks.trim() || null,
          linkedInventoryItemId: row.linkedInventoryItemId,
          scopeType: row.scopeType, isActive: true,
        })
      ));
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: `${validRows.length} scope item${validRows.length > 1 ? "s" : ""} saved` });
      setPendingRows([]); setAddMode("none");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  }

  async function saveBundle(rows: Omit<BundleRow, "localId">[]) {
    setIsSaving(true);
    try {
      await Promise.all(rows.map(row =>
        apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
          itemName: row.itemName.trim(), unit: row.unit.trim(),
          estimatedQty: row.estimatedQty || "0",
          category: row.category || null, scopeType: row.scopeType, isActive: true,
        })
      ));
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: `${rows.length} bundle item${rows.length !== 1 ? "s" : ""} added` });
      setAddMode("none");
    } catch (err: any) {
      toast({ title: "Bundle save failed", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  }

  async function duplicateItem(item: ProjectScopeItem) {
    try {
      await apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
        itemName: `${item.itemName} (Copy)`, unit: item.unit,
        estimatedQty: String(item.estimatedQty), category: item.category ?? null,
        remarks: item.remarks ?? null, linkedInventoryItemId: (item as any).linkedInventoryItemId ?? null,
        scopeType: (item as any).scopeType ?? "primary", isActive: item.isActive,
      });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      toast({ title: "Item duplicated" });
    } catch (err: any) {
      toast({ title: "Duplicate failed", description: err.message, variant: "destructive" });
    }
  }

  async function saveVariants(item: ProjectScopeItem, ids: number[]) {
    await patchMutation.mutateAsync({ id: item.id, data: { acceptedVariants: ids } });
    setVariantOpen(null);
    toast({ title: "Variants saved" });
  }

  async function moveToCategory(item: ProjectScopeItem, category: string) {
    await patchMutation.mutateAsync({ id: item.id, data: { category } });
    setMovingItem(null);
  }

  function toggleSelectItem(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const visibleIds = grouped.flatMap(g =>
      collapsedCats.has(g.cat) ? [] : g.items.map(i => i.id)
    );
    setSelectedIds(new Set(visibleIds));
  }

  function showUndoSnack(message: string, onUndo: () => void) {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoSnackbar({ message, onUndo });
    undoTimeoutRef.current = setTimeout(() => setUndoSnackbar(null), 5500);
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    const snapshot = scopeItems.filter(i => ids.includes(i.id));
    setSelectedIds(new Set());
    try {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/scope-items/${id}`)));
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      showUndoSnack(
        `${ids.length} scope item${ids.length !== 1 ? "s" : ""} deleted`,
        async () => {
          try {
            await Promise.all(snapshot.map(item =>
              apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
                itemName: item.itemName, unit: item.unit,
                estimatedQty: String(item.estimatedQty),
                category: item.category ?? null,
                remarks: item.remarks ?? null,
                linkedInventoryItemId: (item as any).linkedInventoryItemId ?? null,
                scopeType: (item as any).scopeType ?? "primary",
                isActive: item.isActive,
              })
            ));
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
            setUndoSnackbar(null);
            toast({ title: `${snapshot.length} item${snapshot.length !== 1 ? "s" : ""} restored` });
          } catch (err: any) {
            toast({ title: "Undo failed", description: err.message, variant: "destructive" });
          }
        }
      );
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  const isAdding = addMode === "multiple" && pendingRows.length > 0;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Scope Items", value: totalItems, icon: LayoutList, color: "text-brand-600", bg: "bg-brand-50" },
          { label: "Total Est. Qty", value: totalQty.toLocaleString(), icon: Hash, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Primary Items", value: primaryCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-center gap-3" data-testid={`scope-kpi-${i}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main table card */}
      <div className="premium-card bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Scope Items</h3>
            <p className="text-xs text-slate-400 mt-0.5">Grouped by category — click headers to collapse</p>
          </div>
          {/* Split button: main = Add Multiple, arrow = Add by Bundle */}
          <div className="relative">
            <div className="flex">
              <Button size="sm"
                className="bg-brand-700 hover:bg-brand-800 text-white rounded-r-none border-r border-brand-500/40"
                onClick={() => { setAddMode("multiple"); setPendingRows([newPendingRow()]); setShowAddMenu(false); }}
                data-testid="button-add-scope-multiple">
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
              <button
                className="bg-brand-700 hover:bg-brand-800 text-white px-2 rounded-r-lg flex items-center transition-colors"
                onClick={() => setShowAddMenu(m => !m)}
                data-testid="button-add-scope-menu">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[180px] py-1">
                <button type="button"
                  onClick={() => { setAddMode("bundle"); setShowAddMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2.5"
                  data-testid="menu-scope-add-by-bundle">
                  <Boxes className="w-3.5 h-3.5 text-brand-600 shrink-0" /> Add by Bundle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bulk action bar — visible when items are selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-700" data-testid="bulk-selected-count">{selectedIds.size} selected</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <button type="button" onClick={selectAllVisible}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                data-testid="button-select-visible">
                Select Visible
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                data-testid="button-clear-selection">
                Clear
              </button>
              <button type="button" onClick={deleteSelected}
                className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-100 transition-colors"
                data-testid="button-bulk-delete-scope">
                <Trash2 className="w-3 h-3" /> Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* Multi Add editor — inline, top of card, above table */}
        {isAdding && (
          <div className="border-b border-slate-100">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-brand-50/40">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Add Multiple Items</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingRows.length} row{pendingRows.length !== 1 ? "s" : ""} — fill in details and save
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-brand-200 text-brand-700 hover:bg-brand-50" onClick={addRow}
                data-testid="button-add-more-scope-row">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
              </Button>
            </div>
            <div className="p-5 space-y-3">
              {pendingRows.map((row, i) => (
                <InlineScopeRow key={row.localId} row={row} invItems={allInvItems}
                  onChange={updated => updateRow(row.localId, updated)}
                  onRemove={() => removeRow(row.localId)} rowIndex={i} />
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <button type="button" onClick={() => { setPendingRows([]); setAddMode("none"); }}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                data-testid="button-cancel-inline-scope">
                Cancel
              </button>
              <Button className="bg-brand-700 hover:bg-brand-800 text-white" onClick={saveMultiple}
                disabled={isSaving} data-testid="button-save-scope-items">
                <Save className="w-4 h-4 mr-1.5" />
                {isSaving ? "Saving…" : `Save ${pendingRows.length} Item${pendingRows.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {/* Bundle selector — inline, top of card, above table */}
        {addMode === "bundle" && (
          <div className="border-b border-slate-100">
            <BundleSelector onSave={async (rows) => { await saveBundle(rows); }} onClose={() => setAddMode("none")} invItems={allInvItems} />
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : scopeItems.length === 0 && addMode === "none" ? (
          <div className="p-12 text-center">
            <LayoutList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No scope items yet</p>
            <p className="text-xs text-slate-400 mt-1">Add items to define the project's estimated work quantities.</p>
            <Button size="sm" variant="outline" className="mt-4"
              onClick={() => { setAddMode("multiple"); setPendingRows([newPendingRow()]); }}
              data-testid="button-add-scope-item-empty">
              <Plus className="w-4 h-4 mr-1" /> Add First Item
            </Button>
          </div>
        ) : grouped.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 w-[38%]">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[7%]">Unit</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">Est. Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[13%]">Category</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[32%]">Actions</th>
                </tr>
              </thead>
              {grouped.map(({ cat, items }) => {
                const cfg = CATEGORY_CONFIG[cat] ?? { accent: "#64748b", iconBg: "#f1f5f9", subtitle: "" };
                const CatIcon = CAT_ICONS[cat] ?? LayoutList;
                const isCollapsed = collapsedCats.has(cat);
                const catTotalQty = items.reduce((s, i) => s + parseFloat(String(i.estimatedQty || 0)), 0);

                // Build sub-group entries for Conduit / Fittings
                const sgDefs = cfg.subGroups ?? [];
                const sgMap = new Map<string | null, ProjectScopeItem[]>();
                for (const item of items) {
                  const sg = sgDefs.length ? resolveSubGroup(cat, item.itemName) : null;
                  if (!sgMap.has(sg)) sgMap.set(sg, []);
                  sgMap.get(sg)!.push(item);
                }
                const activeSgEntries = sgDefs
                  .map(sg => ({ ...sg, items: sgMap.get(sg.key) ?? [] }))
                  .filter(sg => sg.items.length > 0);
                const ungroupedItems = sgMap.get(null) ?? [];

                const renderItemRow = (item: ProjectScopeItem) => {
                  const invLinked = (item as any).linkedInventoryItemId
                    ? allInvItems.find(it => it.id === (item as any).linkedInventoryItemId)
                    : null;
                  const variants = (item as any).acceptedVariants as number[] ?? [];
                  const isSupport = (item as any).scopeType === "support";
                  return (
                    <Fragment key={item.id}>
                      <tr
                        style={{ borderLeft: `3px solid ${cfg.accent}55` }}
                        className={`transition-colors border-t border-slate-100/80 ${!item.isActive ? "opacity-40" : ""}`}
                        data-testid={`scope-row-${item.id}`}
                        onMouseEnter={e => (e.currentTarget.style.background = `${cfg.accent}08`)}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-baseline gap-0 flex-wrap">
                            <p className="font-medium text-slate-900 leading-snug text-sm truncate max-w-[260px]" title={item.itemName}>
                              {item.itemName}
                            </p>
                            {isSupport && <ScopeTypeChip scopeType="support" />}
                          </div>
                          {invLinked && (
                            <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-[240px]" title={invLinked.name}>
                              <Package className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                              <span className="truncate">{invLinked.name}</span>
                            </span>
                          )}
                          {variants.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {variants.slice(0, 2).map((vid: number) => {
                                const inv = allInvItems.find(it => it.id === vid);
                                return inv ? (
                                  <span key={vid} className="text-[9px] px-1.5 py-0.5 bg-violet-50 border border-violet-200 text-violet-600 rounded truncate max-w-[120px]" title={inv.name}>
                                    {inv.name}
                                  </span>
                                ) : null;
                              })}
                              {variants.length > 2 && <span className="text-[9px] text-slate-400">+{variants.length - 2}</span>}
                            </div>
                          )}
                          {item.remarks && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[240px]">{item.remarks}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{item.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums text-sm">
                          {parseFloat(String(item.estimatedQty)).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {movingItem === item.id ? (
                            <select
                              className="text-xs border border-brand-300 rounded px-1.5 py-1 bg-white text-slate-700 w-36"
                              value={resolveDisplayCategory(item.category, item.itemName)}
                              onChange={e => moveToCategory(item, e.target.value)}
                              onBlur={() => setMovingItem(null)}
                              autoFocus
                              data-testid={`scope-move-cat-${item.id}`}
                            >
                              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs" style={{ color: cfg.accent }}>{resolveDisplayCategory(item.category, item.itemName)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2 text-[10px] text-slate-400 hover:text-violet-600 hover:bg-violet-50 gap-1"
                              onClick={() => setVariantOpen(variantOpen === item.id ? null : item.id)}
                              title="Add / Edit Variants" data-testid={`button-variant-scope-${item.id}`}>
                              <Zap className="w-3 h-3" />
                              <span className="hidden xl:inline">Variants</span>
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700 hover:bg-brand-50"
                              onClick={() => duplicateItem(item)} title="Duplicate"
                              data-testid={`button-duplicate-scope-${item.id}`}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                              onClick={() => setMovingItem(movingItem === item.id ? null : item.id)}
                              title="Move to Category" data-testid={`button-move-scope-${item.id}`}>
                              <FolderOpen className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700 hover:bg-brand-50"
                              onClick={() => setDialogItem(item)} title="Edit"
                              data-testid={`button-edit-scope-${item.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteTarget(item)} title="Delete"
                              data-testid={`button-delete-scope-${item.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              className={`h-7 w-7 p-0 transition-colors ${selectedIds.has(item.id) ? "text-brand-600 bg-brand-50 hover:bg-brand-100" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}
                              onClick={() => toggleSelectItem(item.id)}
                              title={selectedIds.has(item.id) ? "Deselect" : "Select for bulk action"}
                              data-testid={`button-select-scope-${item.id}`}>
                              {selectedIds.has(item.id)
                                ? <CheckSquare className="w-3.5 h-3.5" />
                                : <Square className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {variantOpen === item.id && (
                        <VariantArea
                          item={item} invItems={allInvItems}
                          onSave={(ids) => saveVariants(item, ids)}
                          onClose={() => setVariantOpen(null)}
                        />
                      )}
                    </Fragment>
                  );
                };

                return (
                  <tbody key={cat}>
                    {/* ── Category header ── */}
                    <tr>
                      <td colSpan={5} style={{ padding: 0, borderLeft: `4px solid ${cfg.accent}` }}>
                        <button
                          type="button"
                          onClick={() => toggleCat(cat)}
                          style={{ background: `${cfg.accent}0d` }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:brightness-95 transition-all"
                          data-testid={`scope-cat-toggle-${cat.replace(/[\s/&]+/g, "-")}`}
                        >
                          {/* Icon box */}
                          <div
                            style={{ background: cfg.iconBg, width: 28, height: 28, color: cfg.accent }}
                            className="rounded-md flex items-center justify-center shrink-0"
                          >
                            <CatIcon className="w-4 h-4" />
                          </div>
                          {/* Name + subtitle */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold leading-tight" style={{ color: cfg.accent }}>{cat}</p>
                            <p className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate">{cfg.subtitle}</p>
                          </div>
                          {/* Count chip */}
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                            style={{ background: `${cfg.accent}1a`, color: cfg.accent }}
                          >
                            {items.length} item{items.length !== 1 ? "s" : ""}
                          </span>
                          {/* Total qty */}
                          <span
                            className="font-mono text-xs font-bold tabular-nums shrink-0 w-16 text-right"
                            style={{ color: cfg.accent }}
                          >
                            {catTotalQty.toLocaleString()}
                          </span>
                          {/* Chevron */}
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                            style={{ color: cfg.accent }}
                          />
                        </button>
                      </td>
                    </tr>

                    {/* ── Item rows (with optional sub-group labels) ── */}
                    {!isCollapsed && (
                      activeSgEntries.length > 0 ? (
                        <>
                          {activeSgEntries.map(sg => (
                            <Fragment key={sg.key}>
                              {/* Sub-group label row */}
                              <tr style={{ background: `${cfg.accent}08`, borderLeft: `3px solid ${cfg.accent}33` }}>
                                <td
                                  colSpan={5}
                                  style={{
                                    paddingLeft: 22, paddingTop: 5, paddingBottom: 5,
                                    borderBottom: `1px solid ${cfg.accent}1f`,
                                  }}
                                >
                                  <span style={{
                                    color: `${cfg.accent}b3`,
                                    fontSize: 8,
                                    letterSpacing: "1.2px",
                                    fontWeight: 700,
                                  }}>
                                    └ {sg.label.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                              {sg.items.map(renderItemRow)}
                            </Fragment>
                          ))}
                          {ungroupedItems.map(renderItemRow)}
                        </>
                      ) : (
                        items.map(renderItemRow)
                      )
                    )}

                    {/* ── Category spacer ── */}
                    <tr><td colSpan={5} style={{ height: 4, background: "#f8fafc", padding: 0 }} /></tr>
                  </tbody>
                );
              })}
            </table>
          </div>
        ) : null}
      </div>

      {/* Add / Edit dialog */}
      <ScopeItemDialog
        projectId={projectId}
        item={dialogItem === "new" ? null : dialogItem}
        open={dialogItem !== null}
        onClose={() => setDialogItem(null)}
      />

      {/* Delete confirm — single item */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Delete Scope Item?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            Remove <span className="font-semibold">"{deleteTarget?.itemName}"</span> from this project's scope? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending} data-testid="button-confirm-delete-scope">
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Undo snackbar — bottom-right fixed overlay */}
      {undoSnackbar && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl"
          data-testid="undo-snackbar">
          <span className="font-medium">{undoSnackbar.message}</span>
          <button
            onClick={undoSnackbar.onUndo}
            className="font-bold text-brand-400 hover:text-brand-300 transition-colors"
            data-testid="button-undo-delete">
            Undo
          </button>
          <button
            onClick={() => { setUndoSnackbar(null); if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); }}
            className="text-slate-500 hover:text-white transition-colors ml-1"
            data-testid="button-dismiss-snackbar">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Progress Drill-Down Row ────────────────────────────────────────────────────
function DrillDownRows({
  entries, unit, estQty,
}: {
  entries: { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[];
  unit: string;
  estQty: number;
}) {
  if (entries.length === 0) {
    return (
      <tr>
        <td />
        <td colSpan={6} className="px-4 pb-3 pt-0">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs text-slate-400 italic">
            No submitted reports have logged quantities for this item yet.
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td />
      <td colSpan={6} className="px-4 pb-4 pt-0">
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
          {/* Sub-table header */}
          <div className="grid grid-cols-[90px_110px_1fr_90px_110px] gap-0 bg-slate-100/80 border-b border-slate-200 px-4 py-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Report #</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Prepared By</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Qty</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Running Total</span>
          </div>
          {/* Sub-table rows */}
          {entries.map((e, i) => {
            const pct = estQty > 0 ? Math.min(100, Math.round((e.runningTotal / estQty) * 1000) / 10) : 0;
            return (
              <div
                key={`${e.reportId}-${i}`}
                className="grid grid-cols-[90px_110px_1fr_90px_110px] gap-0 px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-white/70 transition-colors"
              >
                <span className="text-xs font-mono font-semibold text-brand-700">
                  {e.reportNumber ? `#${e.reportNumber}` : `ID ${e.reportId}`}
                </span>
                <span className="text-xs text-slate-600">
                  {e.reportDate ? format(new Date(e.reportDate + "T00:00:00"), "MMM d, yyyy") : "—"}
                </span>
                <span className="text-xs text-slate-600 truncate pr-2">{e.preparedBy || <span className="text-slate-300 italic">—</span>}</span>
                <span className="text-xs font-semibold text-emerald-700 tabular-nums text-right">
                  +{e.qty.toLocaleString()} {unit}
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs tabular-nums text-slate-700 font-medium">{e.runningTotal.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({pct.toFixed(1)}%)</span>
                </div>
              </div>
            );
          })}
          {/* Summary footer */}
          <div className="px-4 py-2 bg-slate-100/60 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">{entries.length} submitted report{entries.length !== 1 ? "s" : ""} contributed</span>
            <span className="text-xs font-bold text-emerald-700">
              Total: {entries[entries.length - 1]?.runningTotal?.toLocaleString() ?? 0} / {estQty.toLocaleString()} {unit}
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Progress Tab ──────────────────────────────────────────────────────────────
function ProgressTab({ projectId }: { projectId: number }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<{
    scopeItems: any[];
    progress: Record<number, { cumulative: number; remaining: number; pct: number; todayAdded: number; completedBeforeToday: number }>;
    drillDown: Record<number, { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[]>;
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number; todayAdded: number };
  }>({
    queryKey: ["/api/projects", projectId, "progress"],
    queryFn: () => fetch(`/api/projects/${projectId}/progress`, { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading progress…</div>;

  const scopeItems = data?.scopeItems ?? [];
  const progress   = data?.progress ?? {};
  const drillDown  = data?.drillDown ?? {};
  const summary    = data?.summary ?? { overallPct: 0, estTotal: 0, installed: 0, remaining: 0, todayAdded: 0 };
  const hasScopes  = scopeItems.length > 0;

  const summaryPctColor =
    summary.overallPct >= 100 ? "text-emerald-600" :
    summary.overallPct >= 70  ? "text-brand-600"   :
    summary.overallPct >= 40  ? "text-blue-600"    : "text-slate-500";

  function toggleRow(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {!hasScopes && (
        <div className="premium-card bg-white p-12 text-center">
          <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No scope items defined</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Add scope items in the <strong>Scope Items</strong> tab to enable progress tracking.
          </p>
        </div>
      )}

      {hasScopes && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Overall % — spans 2 cols on small */}
            <div className="premium-card bg-white p-4 col-span-2 sm:col-span-1 lg:col-span-2 flex flex-col items-center justify-center gap-1" data-testid="progress-overall">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Overall Progress</p>
              <p className={`text-4xl font-display font-bold ${summaryPctColor}`}>{summary.overallPct.toFixed(1)}%</p>
              {/* Stacked bar */}
              {(() => {
                const prevInstalled = Math.max(0, summary.installed - summary.todayAdded);
                const prevPct = summary.estTotal > 0 ? Math.min(100, (prevInstalled / summary.estTotal) * 100) : 0;
                const todayPct = summary.estTotal > 0 ? Math.min(100 - prevPct, (summary.todayAdded / summary.estTotal) * 100) : 0;
                return (
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative mt-1">
                    <div className="absolute left-0 top-0 h-full bg-emerald-500" style={{ width: `${prevPct}%` }} />
                    <div className="absolute top-0 h-full bg-brand-400" style={{ left: `${prevPct}%`, width: `${todayPct}%` }} />
                  </div>
                );
              })()}
              {summary.todayAdded > 0 && (
                <div className="flex gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[9px] text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Prev</span>
                  <span className="flex items-center gap-1 text-[9px] text-brand-600"><span className="w-2 h-2 rounded-full bg-brand-400 inline-block" />Today</span>
                </div>
              )}
            </div>
            {[
              { label: "Est. Total",      value: summary.estTotal.toLocaleString(),                             icon: Hash,          color: "text-slate-600",   bg: "bg-slate-50"   },
              { label: "Installed",       value: summary.installed.toLocaleString(),                            icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Today Added",     value: summary.todayAdded > 0 ? `+${summary.todayAdded.toLocaleString()}` : "0",   icon: TrendingUp,    color: "text-brand-600",   bg: "bg-brand-50"   },
              { label: "Remaining",       value: summary.remaining.toLocaleString(),                            icon: AlertCircle,   color: "text-amber-600",   bg: "bg-amber-50"   },
              { label: "Scope Items",     value: scopeItems.length.toLocaleString(),                            icon: ListTodo,      color: "text-indigo-600",  bg: "bg-indigo-50"  },
            ].map((s, i) => (
              <div key={i} className="premium-card bg-white p-4 flex items-start gap-3" data-testid={`progress-kpi-${i}`}>
                <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className="text-xl font-display font-bold text-slate-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {summary.installed === 0 && (
            <div className="premium-card bg-white px-5 py-4 flex items-center gap-3 text-sm text-amber-700 bg-amber-50/40 border border-amber-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>No submitted daily reports yet — submit a report with linked scope items to see progress update.</span>
            </div>
          )}

          {/* Progress table with stacked bars */}
          <div className="premium-card bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Progress by Scope Item</h3>
                <p className="text-xs text-slate-400 mt-0.5">Click any row to see which submitted reports contributed to that item's total</p>
              </div>
              {expandedRows.size > 0 && (
                <button
                  onClick={() => setExpandedRows(new Set())}
                  className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                >
                  Collapse all
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="w-9 px-2" />
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[24%]">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[7%]">Unit</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">Est. Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%] text-emerald-600">Before Today</th>
                    <th className="text-right px-4 py-3 font-semibold text-brand-600 w-[10%]">Today</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">Remaining</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {scopeItems.map((scope) => {
                    const p = progress[scope.id] ?? { cumulative: 0, remaining: parseFloat(String(scope.estimatedQty)), pct: 0, todayAdded: 0, completedBeforeToday: 0 };
                    const estQty = parseFloat(String(scope.estimatedQty));
                    const entries = drillDown[scope.id] ?? [];
                    const isExpanded = expandedRows.has(scope.id);
                    const hasDrillDown = p.cumulative > 0;

                    // Stacked bar percentages
                    const prevPct  = estQty > 0 ? Math.min(100, (p.completedBeforeToday / estQty) * 100) : 0;
                    const todayPct = estQty > 0 ? Math.min(100 - prevPct, (p.todayAdded / estQty) * 100) : 0;

                    return (
                      <Fragment key={scope.id}>
                        <tr
                          data-testid={`progress-row-${scope.id}`}
                          onClick={() => hasDrillDown && toggleRow(scope.id)}
                          className={[
                            "transition-colors border-b border-slate-100",
                            hasDrillDown ? "cursor-pointer" : "",
                            isExpanded ? "bg-brand-50/30 border-b-0" : hasDrillDown ? "hover:bg-slate-50" : "",
                            !scope.isActive ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          <td className="px-2 py-3.5 text-center">
                            {hasDrillDown ? (
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded transition-transform text-slate-400 ${isExpanded ? "rotate-90 text-brand-600" : ""}`}>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="inline-block w-5 h-5" />
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-slate-900">{scope.itemName}</p>
                            {scope.category && <p className="text-xs text-slate-400">{scope.category}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{scope.unit}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{estQty.toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-emerald-700 font-medium">
                            {p.completedBeforeToday > 0 ? p.completedBeforeToday.toLocaleString() : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-brand-600 font-medium">
                            {p.todayAdded > 0 ? `+${p.todayAdded.toLocaleString()}` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-slate-800">
                            {p.cumulative > 0 ? (
                              <span className="flex items-center justify-end gap-1">
                                {p.cumulative.toLocaleString()}
                                {entries.length > 0 && (
                                  <span className="text-[10px] font-normal text-slate-400 ml-0.5">({entries.length}r)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-amber-700">{p.remaining.toLocaleString()}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {/* Stacked progress bar */}
                              <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px] relative overflow-hidden">
                                <div className="absolute left-0 top-0 h-full bg-emerald-500 transition-all" style={{ width: `${prevPct}%` }} />
                                <div className="absolute top-0 h-full bg-brand-400 transition-all" style={{ left: `${prevPct}%`, width: `${todayPct}%` }} />
                              </div>
                              <span className={`text-xs font-bold tabular-nums w-12 text-right ${
                                p.pct >= 100 ? "text-emerald-600" : p.pct > 0 ? "text-brand-600" : "text-slate-400"
                              }`}>
                                {p.pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <DrillDownRows entries={entries} unit={scope.unit} estQty={estQty} />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportReportCsv(report: any, projectName: string) {
  const fd = report.formData ?? {};
  const rows: string[][] = [];
  rows.push(["VoltStock — Daily Report Export"]);
  rows.push(["Project:", projectName]);
  rows.push(["Report No.:", report.reportNumber ?? "—"]);
  rows.push(["Report Date:", report.reportDate ?? "—"]);
  rows.push(["Prepared By:", fd.preparedBy ?? "—"]);
  rows.push(["Shift:", fd.shift ?? "—"]);
  rows.push(["Weather:", fd.weather ?? "—"]);
  rows.push([]);
  rows.push(["── MANPOWER ──"]);
  rows.push(["Worker", "Trade", "Status", "Start", "End", "Hours", "Notes"]);
  (fd.manpower ?? []).forEach((r: any) =>
    rows.push([r.workerName ?? "", r.trade ?? "", r.attendanceStatus ?? "", r.startTime ?? "", r.endTime ?? "", String(r.hoursWorked ?? 0), r.notes ?? ""])
  );
  const totalHrs = (fd.manpower ?? []).reduce((s: number, r: any) => s + Number(r.hoursWorked ?? 0), 0);
  rows.push(["", "", "", "", "TOTAL HOURS", String(totalHrs)]);
  rows.push([]);
  rows.push(["── WORK TASKS ──"]);
  rows.push(["#", "Description", "Location", "Qty", "Unit", "Notes"]);
  (fd.tasks ?? []).forEach((t: any, i: number) =>
    rows.push([String(i + 1), t.description ?? "", t.location ?? "", String(t.qty ?? ""), t.unit ?? "", t.notes ?? ""])
  );
  rows.push([]);
  rows.push(["── MATERIALS ──"]);
  rows.push(["Material", "Unit", "Qty Used", "Notes"]);
  (fd.materials ?? []).forEach((m: any) =>
    rows.push([m.description ?? "", m.unit ?? "", String(m.qty ?? ""), m.notes ?? ""])
  );
  rows.push([]);
  rows.push(["── EQUIPMENT ──"]);
  rows.push(["Equipment", "Qty", "Hours", "Notes"]);
  (fd.equipment ?? []).forEach((e: any) =>
    rows.push([e.description ?? "", String(e.qty ?? ""), String(e.hours ?? ""), e.notes ?? ""])
  );
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `report-${report.reportNumber ?? report.id}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Status badge ───────────────────────────────────────────────────────────────
function ReportStatusBadge({ status }: { status: string }) {
  if (status === "submitted") return (
    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0.5 font-semibold">
      Submitted
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-2 py-0.5 font-semibold">
      Draft
    </Badge>
  );
}

// ── Material Usage Tab ─────────────────────────────────────────────────────────
function MaterialUsageTab({ projectId }: { projectId: number }) {
  const { data: movements = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/movements", { projectId, limit: 500 }],
    queryFn: () => fetch(`/api/movements?projectId=${projectId}&limit=500`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });

  const grouped = useMemo(() => {
    const map: Record<string, { name: string; unit: string; issuedQty: number; returnedQty: number; unitCost: number | null }> = {};
    for (const m of movements) {
      const name = m.item?.name ?? m.itemName ?? `Item #${m.itemId}`;
      const unit = m.item?.unitOfMeasure ?? "—";
      if (!map[name]) map[name] = { name, unit, issuedQty: 0, returnedQty: 0, unitCost: null };
      const qty = Number(m.quantity ?? 0);
      if (m.movementType === "issue") {
        map[name].issuedQty += qty;
        const snap = m.unitCostSnapshot ? Number(m.unitCostSnapshot) : null;
        if (snap && snap > 0 && !map[name].unitCost) map[name].unitCost = snap;
      } else if (m.movementType === "return") {
        map[name].returnedQty += qty;
      }
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [movements]);

  const totalIssued   = grouped.reduce((s, g) => s + g.issuedQty, 0);
  const totalReturned = grouped.reduce((s, g) => s + g.returnedQty, 0);
  const totalNetUsed  = totalIssued - totalReturned;
  const totalValue    = grouped.reduce((s, g) => {
    const net = Math.max(0, g.issuedQty - g.returnedQty);
    return s + (g.unitCost ? net * g.unitCost : 0);
  }, 0);

  const fmtValue = (v: number) =>
    v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issued",   value: totalIssued.toLocaleString(),   icon: ArrowUpRight,  color: "text-brand-600",   bg: "bg-brand-50"   },
          { label: "Total Returned", value: totalReturned.toLocaleString(), icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Net Used",       value: totalNetUsed.toLocaleString(),  icon: Package,       color: "text-slate-600",   bg: "bg-slate-50"   },
          { label: "Material Value", value: fmtValue(totalValue),           icon: DollarSign,    color: "text-indigo-600",  bg: "bg-indigo-50"  },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-center gap-3" data-testid={`matusage-kpi-${i}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="premium-card bg-white p-10 text-center text-slate-400 text-sm">Loading material usage…</div>
      ) : grouped.length === 0 ? (
        <div className="premium-card bg-white p-12 text-center">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No material movements</p>
          <p className="text-xs text-slate-400 mt-1">No material movements logged for this project yet.</p>
        </div>
      ) : (
        <div className="premium-card bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 text-sm">Item-Level Material Usage</h3>
            <span className="text-xs text-slate-400 ml-1">({grouped.length} item{grouped.length !== 1 ? "s" : ""})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-material-usage">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">Item Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[60px]">Unit</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[100px]">Issued Qty</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[110px]">Returned Qty</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">Net Used</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[120px]">Material Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grouped.map((g, i) => {
                  const netUsed = Math.max(0, g.issuedQty - g.returnedQty);
                  const value   = g.unitCost ? netUsed * g.unitCost : null;
                  return (
                    <tr key={i} data-testid={`row-matusage-${i}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-800 font-medium">{g.name}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{g.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-brand-700">{g.issuedQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-emerald-600">{g.returnedQty > 0 ? g.returnedQty.toLocaleString() : <span className="text-slate-300">0</span>}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-bold text-slate-900">{netUsed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-indigo-700">
                        {value !== null ? fmtValue(value) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wide">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-xs font-bold text-brand-700 tabular-nums">{totalIssued.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600 tabular-nums">{totalReturned.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-slate-900 tabular-nums">{totalNetUsed.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-indigo-700 tabular-nums">{totalValue > 0 ? fmtValue(totalValue) : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
const TXN_PAGE_SIZE = 10;

function OverviewTab({ project, projectId }: { project: any; projectId: number }) {
  const [txnPage, setTxnPage] = useState(0);

  const { data: reports = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
  const { data: allMovements = [] } = useQuery<any[]>({
    queryKey: ["/api/movements", { projectId, limit: 500 }],
    queryFn: () => fetch(`/api/movements?projectId=${projectId}&limit=500`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
  const { data: progressData } = useQuery<{
    scopeItems: any[];
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number; todayAdded: number };
  }>({
    queryKey: ["/api/projects", projectId, "progress"],
    queryFn: () => fetch(`/api/projects/${projectId}/progress`, { credentials: "include" }).then(r => r.json()),
  });

  const totalReports    = reports.length;
  const draftCount      = reports.filter(r => r.status === "draft").length;
  const submittedCount  = reports.filter(r => r.status === "submitted").length;
  const overallPct      = progressData?.summary?.overallPct ?? 0;
  const totalScopeItems = progressData?.scopeItems?.length ?? 0;
  const totalEstQty     = progressData?.summary?.estTotal ?? 0;
  const todayAdded      = progressData?.summary?.todayAdded ?? 0;
  const statusCfg       = statusConfig[project.status] || { label: project.status, className: "bg-slate-100 text-slate-600" };

  const submittedReports = reports.filter(r => r.status === "submitted");
  const lastSubmittedDate = submittedReports.length > 0
    ? [...submittedReports].sort((a, b) => (b.reportDate ?? "") > (a.reportDate ?? "") ? 1 : -1)[0]?.reportDate ?? null
    : null;

  // Material KPIs from real movement data
  const matIssued   = allMovements.filter(m => m.movementType === "issue").reduce((s: number, m: any) => s + Number(m.quantity ?? 0), 0);
  const matReturned = allMovements.filter(m => m.movementType === "return").reduce((s: number, m: any) => s + Number(m.quantity ?? 0), 0);
  const matNetUsed  = matIssued - matReturned;
  const matValue    = allMovements.reduce((s: number, m: any) => {
    if (m.movementType !== "issue") return s;
    const snap = m.unitCostSnapshot ? Number(m.unitCostSnapshot) : 0;
    return s + snap * Number(m.quantity ?? 0);
  }, 0);

  // Paginated movements (newest first)
  const sortedMovements = useMemo(() =>
    [...allMovements].sort((a, b) => {
      const da = a.transactionDate ?? a.createdAt ?? "";
      const db = b.transactionDate ?? b.createdAt ?? "";
      return da > db ? -1 : da < db ? 1 : 0;
    }), [allMovements]);

  const totalTxnPages   = Math.ceil(sortedMovements.length / TXN_PAGE_SIZE);
  const pageMovements   = sortedMovements.slice(txnPage * TXN_PAGE_SIZE, (txnPage + 1) * TXN_PAGE_SIZE);

  const pctColor = overallPct >= 100 ? "bg-emerald-500" : overallPct >= 70 ? "bg-brand-500" : overallPct >= 40 ? "bg-blue-400" : "bg-slate-300";
  const pctText  = overallPct >= 100 ? "text-emerald-600" : overallPct >= 70 ? "text-brand-600" : overallPct >= 40 ? "text-blue-600" : "text-slate-400";

  const fmtValue = (v: number) =>
    v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—";

  return (
    <div className="space-y-5">
      {/* ── Top row: project card + mini stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Project info */}
        <div className="lg:col-span-2 premium-card bg-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Project</p>
              <h2 className="text-2xl font-display font-bold text-slate-900">{project.name}</h2>
              {project.customerName && <p className="text-sm text-slate-500 mt-0.5">{project.customerName}</p>}
            </div>
            <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold shrink-0`}>{statusCfg.label}</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            {project.poNumber && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
                <p className="text-sm font-mono font-bold text-brand-700">{project.poNumber}</p>
              </div>
            )}
            {project.ownerName && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Owner / Manager</p>
                <p className="text-sm font-semibold text-slate-800">{project.ownerName}</p>
              </div>
            )}
            {project.jobLocation && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Location</p>
                <p className="text-sm text-slate-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{project.jobLocation}</p>
              </div>
            )}
            {project.startDate && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Start Date</p>
                <p className="text-sm text-slate-700">{format(new Date(project.startDate + "T00:00:00"), "MMM d, yyyy")}</p>
              </div>
            )}
            {project.endDate && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">End Date</p>
                <p className="text-sm text-slate-700">{format(new Date(project.endDate + "T00:00:00"), "MMM d, yyyy")}</p>
              </div>
            )}
          </div>

          {project.notes && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-600 leading-relaxed">{project.notes}</p>
            </div>
          )}
        </div>

        {/* Right column: report stats + progress */}
        <div className="space-y-4">
          {/* Daily report stats */}
          <div className="premium-card bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />Daily Reports
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Total Reports</span>
                <span className="text-lg font-display font-bold text-slate-900">{totalReports}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: totalReports ? `${(submittedCount / totalReports) * 100}%` : "0%" }} />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 text-center px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Submitted</p>
                  <p className="text-xl font-bold text-emerald-700">{submittedCount}</p>
                </div>
                <div className="flex-1 text-center px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-[10px] text-amber-600 uppercase tracking-wide">Draft</p>
                  <p className="text-xl font-bold text-amber-700">{draftCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress summary */}
          <div className="premium-card bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />Overall Progress
            </p>
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-4xl font-display font-bold ${pctText}`}>{overallPct.toFixed(1)}%</span>
              <span className="text-xs text-slate-400 mb-1">complete</span>
            </div>
            {/* Stacked bar: prev completed + today added */}
            {(() => {
              const installed = progressData?.summary?.installed ?? 0;
              const estTotal  = progressData?.summary?.estTotal ?? 0;
              const prevInstalled = Math.max(0, installed - todayAdded);
              const prevPct  = estTotal > 0 ? Math.min(100, (prevInstalled / estTotal) * 100) : 0;
              const todayPct = estTotal > 0 ? Math.min(100 - prevPct, (todayAdded / estTotal) * 100) : 0;
              return (
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                  <div className="absolute left-0 top-0 h-full bg-emerald-500 transition-all" style={{ width: `${prevPct}%` }} />
                  <div className="absolute top-0 h-full bg-brand-400 transition-all" style={{ left: `${prevPct}%`, width: `${todayPct}%` }} />
                </div>
              );
            })()}
            {todayAdded > 0 && (
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-[10px] text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Previous</span>
                <span className="flex items-center gap-1 text-[10px] text-brand-600"><span className="w-2 h-2 rounded-full bg-brand-400 inline-block" />Today: +{todayAdded.toLocaleString()}</span>
              </div>
            )}
            {progressData && (
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400">Installed</p>
                  <p className="text-sm font-bold text-emerald-700">{progressData.summary.installed.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Remaining</p>
                  <p className="text-sm font-bold text-amber-700">{progressData.summary.remaining.toLocaleString()}</p>
                </div>
                {todayAdded > 0 && (
                  <div>
                    <p className="text-[10px] text-brand-500">Today Added</p>
                    <p className="text-sm font-bold text-brand-600">+{todayAdded.toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-400">Est. Total</p>
                  <p className="text-sm font-bold text-slate-700">{progressData.summary.estTotal.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Scope & Progress Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="premium-card bg-white p-4 flex items-center gap-3" data-testid="overview-scope-count">
          <div className="p-2 rounded-xl bg-indigo-50"><LayoutList className="w-4 h-4 text-indigo-600" /></div>
          <div>
            <p className="text-xs text-slate-400">Scope Items</p>
            <p className="text-2xl font-display font-bold text-slate-900">{totalScopeItems}</p>
          </div>
        </div>
        <div className="premium-card bg-white p-4 flex items-center gap-3" data-testid="overview-est-qty">
          <div className="p-2 rounded-xl bg-brand-50"><Hash className="w-4 h-4 text-brand-600" /></div>
          <div>
            <p className="text-xs text-slate-400">Total Est. Qty</p>
            <p className="text-2xl font-display font-bold text-slate-900">{totalEstQty.toLocaleString()}</p>
          </div>
        </div>
        <div className="premium-card bg-white p-4 flex items-center gap-3 col-span-2 sm:col-span-1" data-testid="overview-last-submitted">
          <div className="p-2 rounded-xl bg-slate-50"><Clock className="w-4 h-4 text-slate-500" /></div>
          <div>
            <p className="text-xs text-slate-400">Last Submitted Report</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {lastSubmittedDate
                ? format(new Date(lastSubmittedDate + "T00:00:00"), "MMM d, yyyy")
                : <span className="text-slate-400 font-normal text-xs">No submitted reports yet</span>
              }
            </p>
          </div>
        </div>
      </div>

      {/* ── Material KPIs (real movement data) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issued",   value: matIssued.toLocaleString(),  icon: ArrowUpRight,  color: "text-brand-600",   bg: "bg-brand-50"   },
          { label: "Total Returned", value: matReturned.toLocaleString(),icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Net Used",       value: matNetUsed.toLocaleString(),  icon: Package,       color: "text-slate-600",   bg: "bg-slate-50"   },
          { label: "Est. Value",     value: fmtValue(matValue),           icon: DollarSign,    color: "text-indigo-600",  bg: "bg-indigo-50"  },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-start gap-3" data-testid={`overview-mat-kpi-${i}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Recent Transactions (paginated, 10/page) ── */}
      {sortedMovements.length > 0 && (
        <div className="premium-card bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-brand-500" />Recent Material Transactions
            </p>
            <span className="text-[10px] text-slate-400">
              {sortedMovements.length} total — newest first
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[90px]">Date</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500">Item</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[80px]">Type</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-500 w-[70px]">Qty</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[50px]">Unit</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageMovements.map((m: any) => {
                  const isIssue = m.movementType === "issue";
                  const dateStr = m.transactionDate ?? m.createdAt;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                        {dateStr ? format(new Date(dateStr), "MMM d, yy") : "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-medium truncate max-w-[200px]">
                        {m.item?.name ?? m.itemName ?? `Item #${m.itemId}`}
                      </td>
                      <td className="px-4 py-2">
                        {isIssue ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-brand-50 text-brand-700 border border-brand-100">
                            ↑ Issue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            ↓ Return
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-slate-700">
                        {Number(m.quantity ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-400">
                        {m.item?.unitOfMeasure ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-400 truncate max-w-[120px]">
                        {m.createdBy ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination controls */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {txnPage * TXN_PAGE_SIZE + 1}–{Math.min((txnPage + 1) * TXN_PAGE_SIZE, sortedMovements.length)} of {sortedMovements.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                data-testid="btn-txn-prev"
                onClick={() => setTxnPage(p => Math.max(0, p - 1))}
                disabled={txnPage === 0}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
                {txnPage + 1} / {Math.max(1, totalTxnPages)}
              </span>
              <button
                data-testid="btn-txn-next"
                onClick={() => setTxnPage(p => Math.min(totalTxnPages - 1, p + 1))}
                disabled={txnPage >= totalTxnPages - 1}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Daily Reports Tab ──────────────────────────────────────────────────────────
function DailyReportsTab({ projectId, project }: { projectId: number; project: any }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "draft" | "submitted">("all");

  const { data: me } = useQuery<{ role: string; username: string }>({
    queryKey: ["/api/me"],
    queryFn: () => fetch("/api/me", { credentials: "include" }).then(r => r.json()),
  });
  const canForceEdit = me?.role === "admin" || me?.role === "manager";

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });

  const sorted = [...reports].sort((a, b) => {
    const da = a.reportDate ?? a.createdAt ?? "";
    const db = b.reportDate ?? b.createdAt ?? "";
    return da > db ? -1 : da < db ? 1 : 0;
  });
  const filtered = filter === "all" ? sorted : sorted.filter(r => r.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {(["all", "submitted", "draft"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-reports-${f}`}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              filter === f
                ? f === "submitted" ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : f === "draft" ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-slate-800 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300",
            ].join(" ")}
          >
            {f === "all" ? `All (${reports.length})` : f === "submitted" ? `Submitted (${reports.filter(r=>r.status==="submitted").length})` : `Draft (${reports.filter(r=>r.status==="draft").length})`}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 h-8 bg-white"
          onClick={() => navigate(`/daily-report/${projectId}`)}
          data-testid="btn-goto-workspace"
        >
          <Plus className="w-3.5 h-3.5" />New Report
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="premium-card bg-white p-12 text-center text-slate-400 text-sm">Loading reports…</div>
      ) : filtered.length === 0 ? (
        <div className="premium-card bg-white p-12 text-center">
          <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No reports found</p>
          <p className="text-xs text-slate-400 mt-1">
            {filter === "all" ? "No daily reports yet for this project." : `No ${filter} reports.`}
          </p>
        </div>
      ) : (
        <div className="premium-card bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-daily-reports">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[80px]">Report #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Prepared By</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[70px]">Workers</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[80px]">Man-hrs</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[65px]">Tasks</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[75px]">Materials</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Last Updated</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, idx) => {
                  const fd = r.formData ?? {};
                  const manpower  = Array.isArray(fd.manpower)  ? fd.manpower  : [];
                  const tasks     = Array.isArray(fd.tasks)     ? fd.tasks     : [];
                  const materials = Array.isArray(fd.materials) ? fd.materials : [];
                  const workers   = manpower.length;
                  const manHrs    = manpower.reduce((s: number, mp: any) => s + Number(mp.hoursWorked ?? 0), 0);
                  const submitted = r.status === "submitted";
                  const dateStr  = r.reportDate ?? null;
                  const updatedAt = r.updatedAt ? new Date(r.updatedAt) : null;

                  return (
                    <tr
                      key={r.id}
                      data-testid={`row-report-${r.id}`}
                      className={`hover:bg-slate-50 transition-colors ${submitted ? "" : "bg-amber-50/20"}`}
                    >
                      {/* Status accent line via left border */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-6 rounded-full shrink-0 ${submitted ? "bg-emerald-400" : "bg-amber-400"}`} />
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {r.reportNumber ? `#${r.reportNumber}` : `—`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {dateStr ? format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {fd.preparedBy || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ReportStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {workers > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Users className="w-3 h-3 text-slate-400" />{workers}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {manHrs > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />{manHrs.toFixed(1)}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tasks.length > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <ListTodo className="w-3 h-3 text-slate-400" />{tasks.length}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {materials.length > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Package className="w-3 h-3 text-slate-400" />{materials.length}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {updatedAt ? updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`text-xs h-7 px-2.5 gap-1 ${submitted && canForceEdit ? "border-brand-200 text-brand-700 hover:bg-brand-50" : ""}`}
                            data-testid={`btn-edit-report-${r.id}`}
                            onClick={() => {
                              const forceEditParam = submitted && canForceEdit ? "&forceEdit=true" : "";
                              navigate(`/daily-report/${projectId}?reportId=${r.id}${forceEditParam}`);
                            }}
                          >
                            {submitted && canForceEdit ? <Pencil className="w-3 h-3" /> : submitted ? <Eye className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            {submitted && canForceEdit ? "Edit" : submitted ? "View" : "Edit"}
                          </Button>
                          {submitted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2.5 gap-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                              data-testid={`btn-export-report-${r.id}`}
                              onClick={() => {
                                exportReportCsv(r, project.name);
                                toast({ title: "Exported", description: `Report #${r.reportNumber ?? r.id} downloaded as CSV.` });
                              }}
                            >
                              <Download className="w-3 h-3" />CSV
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Project Details Sidebar ────────────────────────────────────────────────────
function ProjectDetailsSidebar({ project }: { project: any }) {
  return (
    <Card className="premium-card border-none">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <CardTitle className="text-sm font-semibold text-slate-700">Project Details</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4 text-sm">
        {project.poNumber && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
            <p className="font-semibold text-brand-700">{project.poNumber}</p>
          </div>
        )}
        {project.ownerName && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Project Owner</p>
            <p className="font-semibold text-slate-900">{project.ownerName}</p>
          </div>
        )}
        {project.jobLocation && (
          <div className="flex gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-600">{project.jobLocation}</p>
          </div>
        )}
        {(project.startDate || project.endDate) && (
          <div className="flex gap-3">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              {project.startDate && (
                <p className="text-slate-600">
                  <span className="text-slate-400">Start: </span>
                  {format(new Date(project.startDate + "T00:00:00"), 'MMM d, yyyy')}
                </p>
              )}
              {project.endDate && (
                <p className="text-slate-600">
                  <span className="text-slate-400">End: </span>
                  {format(new Date(project.endDate + "T00:00:00"), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
        )}
        {project.notes && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-slate-600 leading-relaxed">{project.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id || "0");
  const { data: project, isLoading } = useProject(id);
  const { data: allProjects = [] } = useProjects();
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 w-64 rounded" />
      <div className="h-48 bg-slate-200 rounded-2xl" />
    </div>
  );
  if (!project) return <div className="p-8 text-center text-slate-500">Project not found.</div>;

  const statusCfg = statusConfig[project.status] || { label: project.status, className: "" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projects" className="p-2 hover:bg-white rounded-full text-slate-500 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold`}>{statusCfg.label}</Badge>
            {project.poNumber && (
              <span className="text-sm font-mono font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg">
                PO: {project.poNumber}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mt-2">{project.name}</h1>
          {project.customerName && <p className="text-slate-500 mt-1">{project.customerName}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => setEditOpen(true)} data-testid="button-edit-project">
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <Button className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm" onClick={() => setLogOpen(true)}>
              <ArrowUpRight className="w-4 h-4 mr-2" />Log Material
            </Button>
            <DialogContent className="sm:max-w-[760px] flex flex-col max-h-[90vh] gap-0 p-0">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                <DialogTitle>Log Material for {project.code}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-6 overflow-hidden">
                <MovementForm defaultType="issue" onSuccess={() => setLogOpen(false)} onCancel={() => setLogOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <EditProjectDialog project={project} open={editOpen} onClose={() => setEditOpen(false)} allProjects={allProjects} />

      {/* Main tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-4">
          <TabsTrigger value="overview" className="rounded-lg" data-testid="tab-overview">
            <FileBarChart className="w-3.5 h-3.5 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="scope" className="rounded-lg" data-testid="tab-scope-items">
            <LayoutList className="w-3.5 h-3.5 mr-1.5" />Scope Items
          </TabsTrigger>
          <TabsTrigger value="material-usage" className="rounded-lg" data-testid="tab-material-usage">
            <Package className="w-3.5 h-3.5 mr-1.5" />Material Usage
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg" data-testid="tab-reports">
            <FileText className="w-3.5 h-3.5 mr-1.5" />Daily Reports
          </TabsTrigger>
          <TabsTrigger value="progress" className="rounded-lg" data-testid="tab-progress">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Progress
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <OverviewTab project={project} projectId={id} />
        </TabsContent>

        {/* Scope Items */}
        <TabsContent value="scope">
          <ScopeItemsTab projectId={id} />
        </TabsContent>

        {/* Material Usage */}
        <TabsContent value="material-usage">
          <MaterialUsageTab projectId={id} />
        </TabsContent>

        {/* Daily Reports */}
        <TabsContent value="reports">
          <DailyReportsTab projectId={id} project={project} />
        </TabsContent>

        {/* Progress */}
        <TabsContent value="progress">
          <ProgressTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
