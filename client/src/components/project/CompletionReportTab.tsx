import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Upload, Trash2, FileText, Image, Camera,
  ChevronDown, ChevronUp, Loader2, Plus, ArrowUp, ArrowDown, GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Photo {
  id: number;
  photoUrl: string;
  photoDate: string | null;
  description: string | null;
  sortOrder: number;
}

interface ReportData {
  id: number;
  projectId: number;
  contractItem: string | null;
  workDescription: string | null;
  completionDate: string | null;
  quotationImageUrl: string | null;
  drawingImageUrl: string | null;
  photos: Photo[];
}

export function CompletionReportTab({ projectId, project }: { projectId: number; project: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/projects", projectId, "completion-report"],
    queryFn: () => fetch(`/api/projects/${projectId}/completion-report`, { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "completion-report"] });

  const updateMut = useMutation({
    mutationFn: (data: Partial<ReportData>) =>
      apiRequest("PUT", `/api/projects/${projectId}/completion-report`, data),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (photoId: number) =>
      apiRequest("DELETE", `/api/projects/${projectId}/completion-report/photos/${photoId}`),
    onSuccess: invalidate,
  });

  async function handleUpload(type: "quotation" | "drawing" | "photo", file: File, pdfPage?: number) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    if (pdfPage !== undefined) fd.append("pdfPage", String(pdfPage));
    const res = await fetch(`/api/projects/${projectId}/completion-report/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    invalidate();
  }

  async function getPdfPageCount(file: File): Promise<number> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/completion-report/pdf-info`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) return 1;
    const data = await res.json();
    return data.pageCount ?? 1;
  }

  async function getPdfPreview(file: File, page: number): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/completion-report/pdf-preview?page=${page}`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error("Preview failed");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function handlePhotoMeta(photoId: number, field: "photoDate" | "description", value: string) {
    await apiRequest("PATCH", `/api/projects/${projectId}/completion-report/photos/${photoId}`, {
      [field]: value,
    });
    invalidate();
  }

  async function handleReorder(photos: Photo[], fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= photos.length) return;
    const reordered = [...photos];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const orderedIds = reordered.map(p => p.id);
    await apiRequest("POST", `/api/projects/${projectId}/completion-report/reorder`, { orderedIds });
    invalidate();
  }

  async function handleDragEnd(event: DragEndEvent, photos: Photo[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = photos.findIndex(p => p.id === active.id);
    const newIdx = photos.findIndex(p => p.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(photos, oldIdx, newIdx);
    const orderedIds = reordered.map(p => p.id);
    await apiRequest("POST", `/api/projects/${projectId}/completion-report/reorder`, { orderedIds });
    invalidate();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/completion-report/export`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (project.name ?? "report").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      a.download = `${safeName}_completion_report.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PPTX exported successfully" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
    </div>
  );

  if (!report) return null;

  const photos = report.photos ?? [];

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Export button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Work Final Report</h2>
          <p className="text-sm text-slate-500">Fill in details and upload images, then export as PPTX</p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting}
          className="bg-brand-700 hover:bg-brand-800 text-white gap-2"
          data-testid="button-export-pptx"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export PPTX
        </Button>
      </div>

      {/* Slide 1 – Cover (auto) */}
      <SlideSection label="Slide 1" title="Cover" icon={<FileText className="w-4 h-4" />} defaultOpen>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
          <InfoRow label="Project Name" value={project.name} />
          <InfoRow label="PO Number"    value={project.poNumber ?? project.code} />
        </div>
        <p className="text-xs text-slate-400 mt-2">Auto-filled from project data. No editing needed.</p>
      </SlideSection>

      {/* Slide 2 – Work Final Report */}
      <SlideSection label="Slide 2" title="Work Final Report" icon={<FileText className="w-4 h-4" />} defaultOpen>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
            <InfoRow label="Project Name" value={project.name} />
            <InfoRow label="PO Number"    value={project.poNumber ?? project.code} />
            <InfoRow label="Company Name" value="TK ELECTRIC LLC." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Contract Item</Label>
              <Input
                defaultValue={report.contractItem ?? "Electric Works"}
                onBlur={e => updateMut.mutate({ contractItem: e.target.value })}
                placeholder="Electric Works"
                data-testid="input-contract-item"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Completion Date</Label>
              <Input
                type="date"
                defaultValue={report.completionDate ?? ""}
                onChange={e => updateMut.mutate({ completionDate: e.target.value })}
                data-testid="input-completion-date"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Work Description</Label>
            <Textarea
              key={report.id}
              defaultValue={report.workDescription ?? ""}
              onBlur={e => updateMut.mutate({ workDescription: e.target.value })}
              placeholder={"- Install 480V, 100A, 3P electrical panel…\n- Install eight (8) L8-30R receptacles…"}
              rows={4}
              data-testid="textarea-work-description"
            />
            <p className="text-xs text-slate-400">Each line becomes a bullet point in the slide.</p>
          </div>
        </div>
      </SlideSection>

      {/* Slide 3 – Quotation */}
      <SlideSection label="Slide 3" title="Quotation" icon={<Image className="w-4 h-4" />} defaultOpen>
        <ImageUploadBox
          label="Upload quotation (JPG / PNG / PDF)"
          hint="PDF: first page will be captured automatically"
          currentUrl={report.quotationImageUrl}
          onUpload={(f, page) => handleUpload("quotation", f, page)}
          onGetPdfPageCount={getPdfPageCount}
          onGetPdfPreview={getPdfPreview}
          onRemove={() => updateMut.mutate({ quotationImageUrl: null })}
          testId="upload-quotation"
          acceptPdf
        />
      </SlideSection>

      {/* Slide 4 – Drawing */}
      <SlideSection label="Slide 4" title="Drawing" icon={<Image className="w-4 h-4" />} defaultOpen>
        <ImageUploadBox
          label="Upload drawing / CAD image (JPG / PNG / PDF)"
          currentUrl={report.drawingImageUrl}
          onUpload={(f, page) => handleUpload("drawing", f, page)}
          onGetPdfPageCount={getPdfPageCount}
          onGetPdfPreview={getPdfPreview}
          onRemove={() => updateMut.mutate({ drawingImageUrl: null })}
          testId="upload-drawing"
          acceptPdf
        />
      </SlideSection>

      {/* Slide 5+ – Photos */}
      <SlideSection label="Slide 5+" title="Test / Work Photos (2 per slide)" icon={<Camera className="w-4 h-4" />} defaultOpen>
        <div className="space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={e => handleDragEnd(e, photos)}
          >
            <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {photos.map((photo, idx) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={idx + 1}
                    isFirst={idx === 0}
                    isLast={idx === photos.length - 1}
                    onDelete={() => deleteMut.mutate(photo.id)}
                    onMetaChange={(field, val) => handlePhotoMeta(photo.id, field, val)}
                    onMoveUp={() => handleReorder(photos, idx, idx - 1)}
                    onMoveDown={() => handleReorder(photos, idx, idx + 1)}
                  />
                ))}
                <AddPhotoBox onAdd={f => handleUpload("photo", f)} />
              </div>
            </SortableContext>
          </DndContext>
          <p className="text-xs text-slate-400">Photos are displayed 2 per slide. Drag to reorder, or use ↑↓ arrows. Add as many as needed.</p>
        </div>
      </SlideSection>

    </div>
  );
}

function SlideSection({
  label, title, icon, children, defaultOpen = false,
}: {
  label: string; title: string; icon: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="premium-card bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-slate-700 font-semibold text-sm">
          {icon} {title}
        </span>
        <span className="ml-auto text-slate-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-xs text-slate-400">{label}</span>
      <p className="font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

function ImageUploadBox({
  label, hint, currentUrl, onUpload, onGetPdfPageCount, onGetPdfPreview, onRemove, testId, acceptPdf = false,
}: {
  label: string;
  hint?: string;
  currentUrl: string | null | undefined;
  onUpload: (f: File, pdfPage?: number) => Promise<void>;
  onGetPdfPageCount?: (f: File) => Promise<number>;
  onGetPdfPreview?: (f: File, page: number) => Promise<string>;
  onRemove: () => void;
  testId: string;
  acceptPdf?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [checkingPages, setCheckingPages] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevPreviewUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingFile || !onGetPdfPreview) return;
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = await onGetPdfPreview(pendingFile, selectedPage);
        if (prevPreviewUrl.current) URL.revokeObjectURL(prevPreviewUrl.current);
        prevPreviewUrl.current = url;
        setPreviewUrl(url);
      } catch {
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingFile, selectedPage, onGetPdfPreview]);

  useEffect(() => {
    return () => {
      if (prevPreviewUrl.current) URL.revokeObjectURL(prevPreviewUrl.current);
    };
  }, []);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf && onGetPdfPageCount) {
      setCheckingPages(true);
      try {
        const count = await onGetPdfPageCount(file);
        if (count > 1) {
          setPendingFile(file);
          setPdfPageCount(count);
          setSelectedPage(1);
          setPreviewUrl(null);
          return;
        }
      } finally {
        setCheckingPages(false);
      }
    }

    setUploading(true);
    try { await onUpload(file); } finally { setUploading(false); }
  }

  async function confirmPage() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      await onUpload(pendingFile, selectedPage);
      setPendingFile(null);
      setPdfPageCount(null);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }

  function cancelPicker() {
    setPendingFile(null);
    setPdfPageCount(null);
    setSelectedPage(1);
    setPreviewUrl(null);
  }

  const accept = acceptPdf ? "image/*,.pdf,application/pdf" : "image/*";

  if (currentUrl) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
        <img src={currentUrl} alt="uploaded" className="w-full max-h-72 object-contain" />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-red-600 rounded-full p-1.5 shadow border border-slate-200"
          data-testid={`${testId}-remove`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (pendingFile && pdfPageCount !== null) {
    return (
      <div className="border-2 border-brand-300 bg-brand-50/40 rounded-xl p-5 space-y-4" data-testid={`${testId}-page-picker`}>
        <p className="text-sm font-medium text-slate-700">
          <FileText className="w-4 h-4 inline mr-1.5 text-brand-500" />
          <span className="font-semibold text-brand-700">{pendingFile.name}</span>
          {" "}has <span className="font-bold">{pdfPageCount}</span> pages.
        </p>
        <div className="flex gap-4 items-start">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600 shrink-0">Use page:</label>
              <input
                type="number"
                min={1}
                max={pdfPageCount}
                value={selectedPage}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setSelectedPage(Math.min(pdfPageCount, Math.max(1, v)));
                }}
                className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                data-testid={`${testId}-page-input`}
              />
              <span className="text-sm text-slate-400">of {pdfPageCount}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmPage}
                disabled={uploading}
                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-60"
                data-testid={`${testId}-confirm-page`}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload page {selectedPage}
              </button>
              <button
                onClick={cancelPicker}
                disabled={uploading}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                data-testid={`${testId}-cancel-page`}
              >
                Cancel
              </button>
            </div>
          </div>
          <div
            className="w-36 h-24 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0"
            data-testid={`${testId}-preview`}
          >
            {previewLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
            ) : previewUrl ? (
              <img src={previewUrl} alt={`Page ${selectedPage} preview`} className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400 text-center px-2">Preview loading…</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
      onClick={() => inputRef.current?.click()}
      data-testid={`${testId}-dropzone`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={pick} />
      {(uploading || checkingPages)
        ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500" />
        : <>
          <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-500">{label}</p>
          {hint && <p className="text-xs text-brand-500 mt-0.5">{hint}</p>}
          <p className="text-xs text-slate-400 mt-1">Click to browse</p>
        </>
      }
    </div>
  );
}

function PhotoCard({
  photo, index, isFirst, isLast, onDelete, onMetaChange, onMoveUp, onMoveDown,
}: {
  photo: Photo;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
  onMetaChange: (field: "photoDate" | "description", val: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-slate-200 rounded-xl overflow-hidden bg-white"
      data-testid={`photo-card-${photo.id}`}
    >
      <div className="relative">
        <img src={photo.photoUrl} alt={`Photo ${index}`} className="w-full h-44 object-cover" />
        <span className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-0.5 rounded">#{index}</span>
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            {...attributes}
            {...listeners}
            className="bg-white/90 hover:bg-slate-100 text-slate-500 rounded-full p-1.5 shadow cursor-grab active:cursor-grabbing"
            data-testid={`button-drag-${photo.id}`}
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="bg-white/90 hover:bg-slate-100 disabled:opacity-30 text-slate-700 rounded-full p-1.5 shadow"
            data-testid={`button-move-up-${photo.id}`}
            title="Move up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="bg-white/90 hover:bg-slate-100 disabled:opacity-30 text-slate-700 rounded-full p-1.5 shadow"
            data-testid={`button-move-down-${photo.id}`}
            title="Move down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="bg-white/90 hover:bg-red-50 text-red-600 rounded-full p-1.5 shadow"
            data-testid={`button-delete-photo-${photo.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <Label className="text-xs text-slate-500">Date</Label>
          <Input
            type="date"
            defaultValue={photo.photoDate ?? ""}
            onBlur={e => onMetaChange("photoDate", e.target.value)}
            className="h-8 text-xs mt-0.5"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500">Description</Label>
          <Input
            defaultValue={photo.description ?? ""}
            onBlur={e => onMetaChange("description", e.target.value)}
            placeholder="e.g. RM-4001A / CKT43 TEST"
            className="h-8 text-xs mt-0.5"
          />
        </div>
      </div>
    </div>
  );
}

function AddPhotoBox({ onAdd }: { onAdd: (f: File) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) await onAdd(f);
    } finally { setUploading(false); }
    e.target.value = "";
  }

  return (
    <div
      className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors min-h-[180px]"
      onClick={() => inputRef.current?.click()}
      data-testid="add-photo-box"
    >
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
      {uploading
        ? <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        : <>
          <Plus className="w-7 h-7 text-slate-400" />
          <p className="text-sm text-slate-500 text-center">Add photo(s)</p>
          <p className="text-xs text-slate-400">Multiple selection allowed</p>
        </>
      }
    </div>
  );
}
