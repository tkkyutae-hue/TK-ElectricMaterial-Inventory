import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Cpu, PlusCircle, Loader2, CheckCircle2, AlertTriangle, Wrench,
  PauseCircle, Check, X, Trash2, Pencil, ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type EquipmentWithProject, type Project } from "@shared/schema";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "operational",    label: "Operational",    color: "bg-emerald-50 text-emerald-700 border-emerald-200"  },
  { value: "standby",        label: "Standby",        color: "bg-blue-50 text-blue-700 border-blue-200"           },
  { value: "partial_issue",  label: "Partial Issue",  color: "bg-amber-50 text-amber-700 border-amber-200"        },
  { value: "broken_down",    label: "Broken Down",    color: "bg-red-50 text-red-700 border-red-200"              },
] as const;

type StatusValue = typeof STATUS_OPTIONS[number]["value"];

function StatusBadge({ status }: { status: string | null }) {
  const cfg = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[1];
  return (
    <Badge
      variant="outline"
      className={`text-xs font-semibold ${cfg.color}`}
    >
      {cfg.label}
    </Badge>
  );
}

// ─── Empty state icon ─────────────────────────────────────────────────────────
function statusIcon(status: string | null) {
  switch (status) {
    case "operational":   return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "partial_issue": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "broken_down":   return <Wrench className="w-4 h-4 text-red-500" />;
    default:              return <PauseCircle className="w-4 h-4 text-blue-400" />;
  }
}

// ─── Inline add row ────────────────────────────────────────────────────────────
function AddEquipmentRow({
  projects,
  onSaved,
  onCancel,
  autoFocus = false,
}: {
  projects: Project[];
  onSaved: () => void;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const { toast } = useToast();
  const [equipNo, setEquipNo]   = useState("");
  const [name, setName]         = useState("");
  const [brand, setBrand]       = useState("");
  const [sizeSpec, setSizeSpec] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus]     = useState<StatusValue>("standby");
  const [projectId, setProjectId] = useState<string>("");
  const equipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) equipRef.current?.focus();
  }, [autoFocus]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/equipment", {
        equipNo: equipNo.trim(),
        name: name.trim(),
        brand: brand.trim() || null,
        sizeSpec: sizeSpec.trim() || null,
        location: location.trim() || null,
        status,
        assignedProjectId: projectId && projectId !== "__none__" ? Number(projectId) : null,
        isActive: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({ title: "Failed to register equipment", description: err.message, variant: "destructive" });
    },
  });

  function handleSave() {
    if (!equipNo.trim()) { equipRef.current?.focus(); return; }
    if (!name.trim()) return;
    createMutation.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  }

  return (
    <tr className="bg-blue-50/60 border-b border-blue-100">
      {/* Equip # */}
      <td className="px-4 py-2.5">
        <Input
          ref={equipRef}
          data-testid="input-equip-no"
          placeholder="EQ-001"
          value={equipNo}
          onChange={(e) => setEquipNo(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm w-24 bg-white"
        />
      </td>
      {/* Name */}
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-equip-name"
          placeholder="Equipment name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm min-w-[160px] bg-white"
        />
      </td>
      {/* Brand */}
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-equip-brand"
          placeholder="Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm w-28 bg-white"
        />
      </td>
      {/* Size/Spec */}
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-equip-size"
          placeholder="Size / Spec"
          value={sizeSpec}
          onChange={(e) => setSizeSpec(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm w-28 bg-white"
        />
      </td>
      {/* Location */}
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-equip-location"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm w-32 bg-white"
        />
      </td>
      {/* Status */}
      <td className="px-4 py-2.5">
        <Select value={status} onValueChange={(v) => setStatus(v as StatusValue)}>
          <SelectTrigger data-testid="select-equip-status" className="h-8 text-sm w-36 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      {/* Assigned Project */}
      <td className="px-4 py-2.5">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger data-testid="select-equip-project" className="h-8 text-sm w-40 bg-white">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      {/* Actions */}
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            data-testid="btn-equip-save"
            size="sm"
            className="gap-1 h-7 text-xs px-2.5"
            onClick={handleSave}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />}
            Save
          </Button>
          <Button
            data-testid="btn-equip-cancel"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            onClick={onCancel}
            disabled={createMutation.isPending}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Inline edit row ───────────────────────────────────────────────────────────
function EditEquipmentRow({
  item,
  projects,
  onSaved,
  onCancel,
}: {
  item: EquipmentWithProject;
  projects: Project[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [equipNo, setEquipNo]     = useState(item.equipNo);
  const [name, setName]           = useState(item.name);
  const [brand, setBrand]         = useState(item.brand ?? "");
  const [sizeSpec, setSizeSpec]   = useState(item.sizeSpec ?? "");
  const [location, setLocation]   = useState(item.location ?? "");
  const [status, setStatus]       = useState<StatusValue>((item.status ?? "standby") as StatusValue);
  const [projectId, setProjectId] = useState<string>(
    item.assignedProjectId ? String(item.assignedProjectId) : ""
  );

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/equipment/${item.id}`, {
        equipNo: equipNo.trim(),
        name: name.trim(),
        brand: brand.trim() || null,
        sizeSpec: sizeSpec.trim() || null,
        location: location.trim() || null,
        status,
        assignedProjectId: projectId && projectId !== "__none__" ? Number(projectId) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({ title: "Failed to update equipment", description: err.message, variant: "destructive" });
    },
  });

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
  }

  return (
    <tr className="bg-amber-50/50 border-b border-amber-100">
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-edit-equip-no"
          value={equipNo}
          onChange={(e) => setEquipNo(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm w-24 bg-white"
        />
      </td>
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-edit-equip-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm min-w-[160px] bg-white"
        />
      </td>
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-edit-equip-brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm w-28 bg-white"
        />
      </td>
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-edit-equip-size"
          value={sizeSpec}
          onChange={(e) => setSizeSpec(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm w-28 bg-white"
        />
      </td>
      <td className="px-4 py-2.5">
        <Input
          data-testid="input-edit-equip-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm w-32 bg-white"
        />
      </td>
      <td className="px-4 py-2.5">
        <Select value={status} onValueChange={(v) => setStatus(v as StatusValue)}>
          <SelectTrigger data-testid="select-edit-equip-status" className="h-8 text-sm w-36 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-2.5">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger data-testid="select-edit-equip-project" className="h-8 text-sm w-40 bg-white">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            data-testid="btn-equip-update"
            size="sm"
            className="gap-1 h-7 text-xs px-2.5"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />}
            Save
          </Button>
          <Button
            data-testid="btn-equip-edit-cancel"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            onClick={onCancel}
            disabled={updateMutation.isPending}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Equipment() {
  const { toast } = useToast();

  const [draftKeys, setDraftKeys] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [sortByStatus, setSortByStatus] = useState(false);
  const nextKey = useRef(0);

  const { data: equipList = [], isLoading } = useQuery<EquipmentWithProject[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/equipment/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setConfirmDeleteId(null);
      toast({ title: "Equipment removed." });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setConfirmDeleteId(null);
    },
  });

  // ── Summary counts ──
  const statusCounts = STATUS_OPTIONS.map((s) => ({
    ...s,
    count: equipList.filter((e) => e.status === s.value).length,
  }));

  // ── Sort ──
  const STATUS_ORDER: Record<string, number> = {
    operational: 0, partial_issue: 1, broken_down: 2, standby: 3,
  };

  const displayList = sortByStatus
    ? [...equipList].sort((a, b) => {
        const ia = STATUS_ORDER[a.status ?? "standby"] ?? 99;
        const ib = STATUS_ORDER[b.status ?? "standby"] ?? 99;
        return ia !== ib ? ia - ib : a.equipNo.localeCompare(b.equipNo);
      })
    : equipList;

  function removeDraft(key: number) {
    setDraftKeys((prev) => prev.filter((k) => k !== key));
  }

  function handleAddClick() {
    const key = nextKey.current++;
    setDraftKeys((prev) => [...prev, key]);
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Equipment Registry</h1>
        <p className="text-slate-500 mt-1">
          Register and manage all company equipment. Track status, location, and project assignment.
        </p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statusCounts.map(({ label, count, color, value }) => {
          const Icon = value === "operational" ? CheckCircle2
            : value === "partial_issue" ? AlertTriangle
            : value === "broken_down" ? Wrench
            : PauseCircle;
          const iconColor = value === "operational" ? "text-emerald-600"
            : value === "partial_issue" ? "text-amber-600"
            : value === "broken_down" ? "text-red-600"
            : "text-blue-500";
          const bg = value === "operational" ? "bg-emerald-50"
            : value === "partial_issue" ? "bg-amber-50"
            : value === "broken_down" ? "bg-red-50"
            : "bg-blue-50";
          return (
            <Card key={value}>
              <CardContent className="flex items-center gap-4 pt-5 pb-5">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${bg}`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</p>
                  <p className="text-2xl font-bold text-slate-700 leading-tight">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Equipment Registry table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-500" />
              Equipment Registry
              <span className="text-xs font-normal text-slate-400 ml-1">
                ({equipList.length} total)
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                data-testid="btn-sort-status"
                variant={sortByStatus ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => setSortByStatus((v) => !v)}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortByStatus ? "Sorted by Status" : "Sort by Status"}
              </Button>
              <Button
                data-testid="btn-register-equipment"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleAddClick}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Register Equipment
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
              <p className="text-sm text-slate-400">Loading equipment…</p>
            </div>
          ) : equipList.length === 0 && draftKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                <Cpu className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">No equipment registered yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Use "Register Equipment" above to add your first piece of equipment
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">
                      Equip #
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">
                      Brand
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">
                      Size / Spec
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">
                      Location
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-40">
                      Assigned Project
                    </th>
                    <th className="px-4 py-3 w-28" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">

                  {/* Draft add rows */}
                  {draftKeys.map((key, idx) => (
                    <AddEquipmentRow
                      key={key}
                      projects={projects}
                      autoFocus={idx === draftKeys.length - 1}
                      onSaved={() => removeDraft(key)}
                      onCancel={() => removeDraft(key)}
                    />
                  ))}

                  {/* Equipment rows */}
                  {displayList.map((equip) => {
                    const isEditing    = editingId === equip.id;
                    const isConfirming = confirmDeleteId === equip.id;
                    const isDeleting   = deleteMutation.isPending && confirmDeleteId === equip.id;

                    if (isEditing) {
                      return (
                        <EditEquipmentRow
                          key={equip.id}
                          item={equip}
                          projects={projects}
                          onSaved={() => setEditingId(null)}
                          onCancel={() => setEditingId(null)}
                        />
                      );
                    }

                    return (
                      <tr
                        key={equip.id}
                        data-testid={`row-equipment-${equip.id}`}
                        className={`transition-colors ${isConfirming ? "bg-red-50" : "hover:bg-slate-50"}`}
                      >
                        {/* Equip # */}
                        <td className="px-4 py-3">
                          <span
                            data-testid={`text-equip-no-${equip.id}`}
                            className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded"
                          >
                            {equip.equipNo}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {statusIcon(equip.status)}
                            <span
                              data-testid={`text-equip-name-${equip.id}`}
                              className="font-medium text-slate-800"
                            >
                              {equip.name}
                            </span>
                          </div>
                        </td>

                        {/* Brand */}
                        <td className="px-4 py-3">
                          <span data-testid={`text-equip-brand-${equip.id}`} className="text-slate-600">
                            {equip.brand ?? "—"}
                          </span>
                        </td>

                        {/* Size/Spec */}
                        <td className="px-4 py-3">
                          <span data-testid={`text-equip-size-${equip.id}`} className="text-slate-600">
                            {equip.sizeSpec ?? "—"}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3">
                          <span data-testid={`text-equip-location-${equip.id}`} className="text-slate-600">
                            {equip.location ?? "—"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={equip.status} />
                        </td>

                        {/* Assigned Project */}
                        <td className="px-4 py-3">
                          <span
                            data-testid={`text-equip-project-${equip.id}`}
                            className="text-slate-600 text-xs"
                          >
                            {equip.project?.name ?? "—"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isConfirming ? (
                              <>
                                <span className="text-xs text-red-600 font-medium mr-1">Remove?</span>
                                <Button
                                  data-testid={`btn-delete-confirm-${equip.id}`}
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2.5 text-xs gap-1"
                                  onClick={() => deleteMutation.mutate(equip.id)}
                                  disabled={isDeleting}
                                >
                                  {isDeleting
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Check className="w-3 h-3" />}
                                  Yes
                                </Button>
                                <Button
                                  data-testid={`btn-delete-cancel-${equip.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={isDeleting}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  data-testid={`btn-edit-equipment-${equip.id}`}
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs text-slate-500 hover:text-slate-700 h-7 px-2"
                                  onClick={() => setEditingId(equip.id)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </Button>
                                <Button
                                  data-testid={`btn-delete-equipment-${equip.id}`}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                  onClick={() => setConfirmDeleteId(equip.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
