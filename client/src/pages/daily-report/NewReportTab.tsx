import { useState } from "react";
import {
  Calendar, Cloud, Users, Package, Truck, Image,
  BarChart2, FileText, ChevronDown, Plus, Trash2,
  Save, Send, Download, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ─── Collapsible section wrapper ──────────────────────────────────────────────
function Section({
  num, title, icon, defaultOpen = true, children,
}: {
  num: number; title: string; icon: React.ReactNode;
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        data-testid={`section-toggle-${num}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold shrink-0">
            {num}
          </span>
          <span className="text-slate-500 shrink-0">{icon}</span>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <CardContent className="pt-0 pb-5 px-5 border-t border-slate-100">
          <div className="pt-4">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

// ─── Editable table helpers ───────────────────────────────────────────────────
function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-slate-200">
        {cols.map((c) => (
          <th key={c} className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
            {c}
          </th>
        ))}
        <th className="w-8" />
      </tr>
    </thead>
  );
}

// ─── Mock seed data ───────────────────────────────────────────────────────────
const INIT_TASKS = [
  { id: 1, description: "Panel installation – Level 3 east wing", area: "Level 3 / East Wing", status: "in-progress", notes: "" },
  { id: 2, description: "Conduit pull-through – Basement runs", area: "Basement / Elec. Room", status: "completed",   notes: "Passed inspection" },
];
const INIT_MANPOWER = [
  { id: 1, trade: "Journeyman Electrician", count: 5, hoursEach: 8, notes: "" },
  { id: 2, trade: "Apprentice Electrician",  count: 2, hoursEach: 8, notes: "" },
  { id: 3, trade: "Foreman",                 count: 1, hoursEach: 8, notes: "" },
];
const INIT_MATERIALS = [
  { id: 1, description: "EMT Conduit 3/4\"", unit: "LF",  qty: 120, notes: "" },
  { id: 2, description: "Wire 12 AWG THHN",  unit: "LF",  qty: 500, notes: "" },
  { id: 3, description: "1-Gang Box",        unit: "EA",  qty: 24,  notes: "" },
];
const INIT_EQUIPMENT = [
  { id: 1, name: "Scissor Lift",    unit: "EA", qty: 1, hours: 6, notes: "" },
  { id: 2, name: "Wire Reel Stand", unit: "EA", qty: 2, hours: 8, notes: "" },
];

let nextId = 100;
function uid() { return ++nextId; }

// ─── Main component ───────────────────────────────────────────────────────────
export function NewReportTab() {
  // General Info
  const [reportDate,    setReportDate]    = useState("2026-03-17");
  const [reportNumber,  setReportNumber]  = useState("043");
  const [preparedBy,    setPreparedBy]    = useState("Michael Kim");
  const [shift,         setShift]         = useState("day");
  const [weather,       setWeather]       = useState("clear");
  const [temperature,   setTemperature]   = useState("72");

  // Dynamic rows
  const [tasks,      setTasks]      = useState(INIT_TASKS);
  const [manpower,   setManpower]   = useState(INIT_MANPOWER);
  const [materials,  setMaterials]  = useState(INIT_MATERIALS);
  const [equipment,  setEquipment]  = useState(INIT_EQUIPMENT);

  // Progress
  const [overallPct,    setOverallPct]    = useState(62);
  const [onSchedule,    setOnSchedule]    = useState(true);
  const [issues,        setIssues]        = useState("");
  const [nextDayPlan,   setNextDayPlan]   = useState("");

  // Notes
  const [generalNotes,    setGeneralNotes]    = useState("");
  const [safetyNotes,     setSafetyNotes]     = useState("");
  const [inspectorVisitor, setInspectorVisitor] = useState("");

  // Computed
  const totalWorkers = manpower.reduce((s, r) => s + Number(r.count), 0);
  const totalHours   = manpower.reduce((s, r) => s + Number(r.count) * Number(r.hoursEach), 0);

  return (
    <div className="space-y-4">

      {/* ── Action bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            data-testid="btn-save-draft"
            variant="outline"
            size="sm"
            className="gap-2 text-slate-700"
            onClick={() => {}}
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </Button>
          <Button
            data-testid="btn-submit-report"
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {}}
          >
            <Send className="w-3.5 h-3.5" />
            Submit
          </Button>
          <Button
            data-testid="btn-export-excel"
            variant="outline"
            size="sm"
            className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            onClick={() => {}}
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </Button>
        </div>
        <Badge variant="outline" className="text-[11px] text-slate-500 border-slate-200 bg-slate-50">
          Draft — not submitted
        </Badge>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Section 1 — General Info
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={1} title="General Info" icon={<Calendar className="w-4 h-4" />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

          <div>
            <FieldLabel>Report Date</FieldLabel>
            <Input
              data-testid="input-report-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <FieldLabel>Report No.</FieldLabel>
            <Input
              data-testid="input-report-number"
              value={reportNumber}
              onChange={(e) => setReportNumber(e.target.value)}
              className="h-9 text-sm font-mono"
              placeholder="#001"
            />
          </div>

          <div>
            <FieldLabel>Prepared By</FieldLabel>
            <Input
              data-testid="input-prepared-by"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="h-9 text-sm"
              placeholder="Name"
            />
          </div>

          <div>
            <FieldLabel>Shift</FieldLabel>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger data-testid="select-shift" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day Shift</SelectItem>
                <SelectItem value="night">Night Shift</SelectItem>
                <SelectItem value="both">Both Shifts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Weather</FieldLabel>
            <Select value={weather} onValueChange={setWeather}>
              <SelectTrigger data-testid="select-weather" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clear">Clear</SelectItem>
                <SelectItem value="partly-cloudy">Partly Cloudy</SelectItem>
                <SelectItem value="overcast">Overcast</SelectItem>
                <SelectItem value="rain">Rain</SelectItem>
                <SelectItem value="wind">Windy</SelectItem>
                <SelectItem value="heat">Extreme Heat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Temperature (°F)</FieldLabel>
            <Input
              data-testid="input-temperature"
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="h-9 text-sm"
              placeholder="°F"
            />
          </div>

        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 2 — Work Tasks
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={2} title="Work Tasks" icon={<FileText className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-tasks">
            <TableHeader cols={["Task Description", "Area / Location", "Status", "Notes"]} />
            <tbody>
              {tasks.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-2 min-w-[180px]">
                    <Input
                      data-testid={`input-task-desc-${i}`}
                      value={row.description}
                      onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, description: e.target.value } : r))}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[140px]">
                    <Input
                      data-testid={`input-task-area-${i}`}
                      value={row.area}
                      onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, area: e.target.value } : r))}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[130px]">
                    <Select
                      value={row.status}
                      onValueChange={(v) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, status: v } : r))}
                    >
                      <SelectTrigger data-testid={`select-task-status-${i}`} className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="delayed">Delayed</SelectItem>
                        <SelectItem value="not-started">Not Started</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-2 min-w-[140px]">
                    <Input
                      data-testid={`input-task-notes-${i}`}
                      value={row.notes}
                      onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-8 text-xs"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <button
                      type="button"
                      data-testid={`btn-remove-task-${i}`}
                      onClick={() => setTasks(tasks.filter((r) => r.id !== row.id))}
                      className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          data-testid="btn-add-task"
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5 text-xs text-slate-600"
          onClick={() => setTasks([...tasks, { id: uid(), description: "", area: "", status: "in-progress", notes: "" }])}
        >
          <Plus className="w-3.5 h-3.5" /> Add Task
        </Button>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 3 — Manpower
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={3} title="Manpower" icon={<Users className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-manpower">
            <TableHeader cols={["Trade / Classification", "Workers", "Hrs Each", "Total Hrs", "Notes"]} />
            <tbody>
              {manpower.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-2 min-w-[180px]">
                    <Input
                      data-testid={`input-mp-trade-${i}`}
                      value={row.trade}
                      onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, trade: e.target.value } : r))}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[80px]">
                    <Input
                      data-testid={`input-mp-count-${i}`}
                      type="number"
                      min={0}
                      value={row.count}
                      onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, count: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[80px]">
                    <Input
                      data-testid={`input-mp-hours-${i}`}
                      type="number"
                      min={0}
                      value={row.hoursEach}
                      onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, hoursEach: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[80px]">
                    <div className="h-8 flex items-center px-2 text-xs font-semibold text-slate-700 bg-slate-50 rounded-md border border-slate-200">
                      {row.count * row.hoursEach}
                    </div>
                  </td>
                  <td className="py-2 px-2 min-w-[120px]">
                    <Input
                      data-testid={`input-mp-notes-${i}`}
                      value={row.notes}
                      onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-8 text-xs"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <button
                      type="button"
                      data-testid={`btn-remove-mp-${i}`}
                      onClick={() => setManpower(manpower.filter((r) => r.id !== row.id))}
                      className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="py-2 px-2 text-xs font-semibold text-slate-600">Total</td>
                <td className="py-2 px-2">
                  <div className="h-8 flex items-center px-2 text-xs font-bold text-slate-800 bg-white rounded-md border border-slate-200">
                    {totalWorkers}
                  </div>
                </td>
                <td className="py-2 px-2" />
                <td className="py-2 px-2">
                  <div className="h-8 flex items-center px-2 text-xs font-bold text-slate-800 bg-white rounded-md border border-slate-200">
                    {totalHours}
                  </div>
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
        <Button
          data-testid="btn-add-manpower"
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5 text-xs text-slate-600"
          onClick={() => setManpower([...manpower, { id: uid(), trade: "", count: 1, hoursEach: 8, notes: "" }])}
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </Button>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 4 — Materials
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={4} title="Materials" icon={<Package className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-materials">
            <TableHeader cols={["Material Description", "Unit", "Qty Used", "Notes"]} />
            <tbody>
              {materials.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-2 min-w-[200px]">
                    <Input
                      data-testid={`input-mat-desc-${i}`}
                      value={row.description}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, description: e.target.value } : r))}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[80px]">
                    <Input
                      data-testid={`input-mat-unit-${i}`}
                      value={row.unit}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                      className="h-8 text-xs text-center"
                      placeholder="EA"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[80px]">
                    <Input
                      data-testid={`input-mat-qty-${i}`}
                      type="number"
                      min={0}
                      value={row.qty}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[140px]">
                    <Input
                      data-testid={`input-mat-notes-${i}`}
                      value={row.notes}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-8 text-xs"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <button
                      type="button"
                      data-testid={`btn-remove-mat-${i}`}
                      onClick={() => setMaterials(materials.filter((r) => r.id !== row.id))}
                      className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          data-testid="btn-add-material"
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5 text-xs text-slate-600"
          onClick={() => setMaterials([...materials, { id: uid(), description: "", unit: "EA", qty: 1, notes: "" }])}
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </Button>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 5 — Equipment
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={5} title="Equipment" icon={<Truck className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-equipment">
            <TableHeader cols={["Equipment Name", "Unit", "Qty", "Hours Used", "Notes"]} />
            <tbody>
              {equipment.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-2 min-w-[180px]">
                    <Input
                      data-testid={`input-eq-name-${i}`}
                      value={row.name}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[80px]">
                    <Input
                      data-testid={`input-eq-unit-${i}`}
                      value={row.unit}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                      className="h-8 text-xs text-center"
                      placeholder="EA"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[80px]">
                    <Input
                      data-testid={`input-eq-qty-${i}`}
                      type="number"
                      min={0}
                      value={row.qty}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[80px]">
                    <Input
                      data-testid={`input-eq-hours-${i}`}
                      type="number"
                      min={0}
                      value={row.hours}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, hours: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center"
                    />
                  </td>
                  <td className="py-2 px-2 min-w-[140px]">
                    <Input
                      data-testid={`input-eq-notes-${i}`}
                      value={row.notes}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-8 text-xs"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <button
                      type="button"
                      data-testid={`btn-remove-eq-${i}`}
                      onClick={() => setEquipment(equipment.filter((r) => r.id !== row.id))}
                      className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          data-testid="btn-add-equipment"
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5 text-xs text-slate-600"
          onClick={() => setEquipment([...equipment, { id: uid(), name: "", unit: "EA", qty: 1, hours: 0, notes: "" }])}
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </Button>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 6 — Photo Log
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={6} title="Photo Log" icon={<Image className="w-4 h-4" />} defaultOpen={false}>
        <div
          data-testid="photo-upload-zone"
          className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-200">
            <Image className="w-6 h-6 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Click to upload photos</p>
            <p className="text-xs text-slate-400 mt-0.5">PNG, JPG up to 10 MB each — photo upload coming soon</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 text-center">
          Photo upload will be enabled when the backend is connected.
        </p>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 7 — Progress
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={7} title="Progress" icon={<BarChart2 className="w-4 h-4" />}>
        <div className="space-y-4">

          {/* % Complete + schedule toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Overall Completion (%)</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  data-testid="input-overall-pct"
                  type="range"
                  min={0}
                  max={100}
                  value={overallPct}
                  onChange={(e) => setOverallPct(Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-bold text-slate-800 w-10 text-right">{overallPct}%</span>
              </div>
              <div className="mt-1.5 w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>

            <div>
              <FieldLabel>On Schedule?</FieldLabel>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  data-testid="btn-on-schedule-yes"
                  onClick={() => setOnSchedule(true)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    onSchedule
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Yes
                </button>
                <button
                  type="button"
                  data-testid="btn-on-schedule-no"
                  onClick={() => setOnSchedule(false)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    !onSchedule
                      ? "bg-rose-50 border-rose-300 text-rose-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" /> No
                </button>
              </div>
            </div>
          </div>

          {/* Issues / Delays */}
          <div>
            <FieldLabel>Issues / Delays</FieldLabel>
            <Textarea
              data-testid="input-issues"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder="Describe any issues, delays, or blockers encountered today…"
              className="text-sm min-h-[80px] resize-y"
            />
          </div>

          {/* Next Day Plan */}
          <div>
            <FieldLabel>Next Day Work Plan</FieldLabel>
            <Textarea
              data-testid="input-next-day-plan"
              value={nextDayPlan}
              onChange={(e) => setNextDayPlan(e.target.value)}
              placeholder="What is planned for tomorrow's shift?…"
              className="text-sm min-h-[80px] resize-y"
            />
          </div>

        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 8 — Notes / Remarks
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={8} title="Notes / Remarks" icon={<FileText className="w-4 h-4" />} defaultOpen={false}>
        <div className="space-y-4">

          <div>
            <FieldLabel>General Notes</FieldLabel>
            <Textarea
              data-testid="input-general-notes"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Any general observations or notes for the record…"
              className="text-sm min-h-[80px] resize-y"
            />
          </div>

          <div>
            <FieldLabel>Safety Observations</FieldLabel>
            <Textarea
              data-testid="input-safety-notes"
              value={safetyNotes}
              onChange={(e) => setSafetyNotes(e.target.value)}
              placeholder="Safety incidents, near misses, toolbox talk topics…"
              className="text-sm min-h-[80px] resize-y"
            />
          </div>

          <div>
            <FieldLabel>Inspector / Visitor on Site</FieldLabel>
            <Input
              data-testid="input-inspector-visitor"
              value={inspectorVisitor}
              onChange={(e) => setInspectorVisitor(e.target.value)}
              placeholder="Name and affiliation"
              className="h-9 text-sm"
            />
          </div>

        </div>
      </Section>

      {/* ── Bottom action bar (repeat for long forms) ── */}
      <div className="flex items-center gap-2 flex-wrap justify-end pt-2 border-t border-slate-200">
        <Button
          data-testid="btn-save-draft-bottom"
          variant="outline"
          size="sm"
          className="gap-2 text-slate-700"
          onClick={() => {}}
        >
          <Save className="w-3.5 h-3.5" />
          Save Draft
        </Button>
        <Button
          data-testid="btn-submit-report-bottom"
          size="sm"
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => {}}
        >
          <Send className="w-3.5 h-3.5" />
          Submit
        </Button>
        <Button
          data-testid="btn-export-excel-bottom"
          variant="outline"
          size="sm"
          className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          onClick={() => {}}
        >
          <Download className="w-3.5 h-3.5" />
          Export Excel
        </Button>
      </div>

    </div>
  );
}
