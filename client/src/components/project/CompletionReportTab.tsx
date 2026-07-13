import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import {
  Download, Upload, Trash2, FileText, Image, Camera,
  ChevronDown, ChevronUp, Loader2, Plus, ArrowUp, ArrowDown, GripVertical, Pencil, Check, X, Crop as CropIcon,
  ZoomIn, ZoomOut,
} from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
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

type CropFocus = "centre" | "top" | "bottom" | "left" | "right";

interface Photo {
  id: number;
  photoUrl: string;
  photoDate: string | null;
  description: string | null;
  cropFocus: CropFocus | null;
  cropX: string | null;
  cropY: string | null;
  cropWidth: string | null;
  cropHeight: string | null;
  sortOrder: number;
  sectionId: number | null;
}

interface PhotoSection {
  id: number;
  reportId: number;
  title: string;
  photosPerSlide: number;
  sortOrder: number;
  photos: Photo[];
}

interface DrawingSection {
  id: number;
  reportId: number;
  title: string;
  imageUrl: string | null;
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
  sections: PhotoSection[];
  photos: Photo[];
  drawingSections: DrawingSection[];
}

export function CompletionReportTab({ projectId, project }: { projectId: number; project: any }) {
  const { toast } = useToast();
  const { t } = useLanguage();
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

  const addSectionMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/projects/${projectId}/completion-report/sections`, { photosPerSlide: 0 }),
    onSuccess: invalidate,
  });

  const updateSectionMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<PhotoSection, "title" | "photosPerSlide">> }) =>
      apiRequest("PUT", `/api/projects/${projectId}/completion-report/sections/${id}`, data),
    onSuccess: invalidate,
  });

  const deleteSectionMut = useMutation({
    mutationFn: (sectionId: number) =>
      apiRequest("DELETE", `/api/projects/${projectId}/completion-report/sections/${sectionId}`),
    onSuccess: invalidate,
  });

  const addDrawingSectionMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/projects/${projectId}/completion-report/drawing-sections`, {}),
    onSuccess: invalidate,
  });

  const updateDrawingSectionMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; imageUrl?: string | null } }) =>
      apiRequest("PUT", `/api/projects/${projectId}/completion-report/drawing-sections/${id}`, data),
    onSuccess: invalidate,
  });

  const deleteDrawingSectionMut = useMutation({
    mutationFn: (sectionId: number) =>
      apiRequest("DELETE", `/api/projects/${projectId}/completion-report/drawing-sections/${sectionId}`),
    onSuccess: invalidate,
  });

  async function handleDrawingSectionUpload(sectionId: number, file: File, pdfPage?: number) {
    const fd = new FormData();
    fd.append("file", file);
    if (pdfPage !== undefined) fd.append("pdfPage", String(pdfPage));
    const res = await fetch(`/api/projects/${projectId}/completion-report/drawing-sections/${sectionId}/upload`, {
      method: "POST", credentials: "include", body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    invalidate();
  }

  async function handleUpload(type: "quotation" | "drawing", file: File, pdfPage?: number) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    if (pdfPage !== undefined) fd.append("pdfPage", String(pdfPage));
    const res = await fetch(`/api/projects/${projectId}/completion-report/upload`, {
      method: "POST", credentials: "include", body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    invalidate();
  }

  async function handleSectionPhotoUpload(sectionId: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/completion-report/sections/${sectionId}/upload`, {
      method: "POST", credentials: "include", body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    invalidate();
  }

  async function getPdfPageCount(file: File): Promise<number> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/completion-report/pdf-info`, {
      method: "POST", credentials: "include", body: fd,
    });
    if (!res.ok) return 1;
    const data = await res.json();
    return data.pageCount ?? 1;
  }

  async function getPdfPreview(file: File, page: number): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/completion-report/pdf-preview?page=${page}`, {
      method: "POST", credentials: "include", body: fd,
    });
    if (!res.ok) throw new Error("Preview failed");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function handlePhotoMeta(photoId: number, field: "photoDate" | "description", value: string) {
    await apiRequest("PATCH", `/api/projects/${projectId}/completion-report/photos/${photoId}`, { [field]: value });
    invalidate();
  }

  async function handleCropFocusChange(photoId: number, cropFocus: CropFocus) {
    await apiRequest("PATCH", `/api/projects/${projectId}/completion-report/photos/${photoId}`, { cropFocus });
    invalidate();
  }

  async function handleCropChange(
    photoId: number,
    coords: { cropX: number; cropY: number; cropWidth: number; cropHeight: number } | null,
  ) {
    const patch = coords
      ? { cropX: coords.cropX, cropY: coords.cropY, cropWidth: coords.cropWidth, cropHeight: coords.cropHeight }
      : { cropX: null, cropY: null, cropWidth: null, cropHeight: null };
    await apiRequest("PATCH", `/api/projects/${projectId}/completion-report/photos/${photoId}`, patch);
    invalidate();
  }

  async function handleReorder(sectionId: number, photos: Photo[], fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= photos.length) return;
    const reordered = [...photos];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const orderedIds = reordered.map(p => p.id);
    await apiRequest("POST", `/api/projects/${projectId}/completion-report/sections/${sectionId}/reorder`, { orderedIds });
    invalidate();
  }

  async function handleDragEnd(sectionId: number, photos: Photo[], event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = photos.findIndex(p => p.id === active.id);
    const newIdx = photos.findIndex(p => p.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(photos, oldIdx, newIdx);
    const orderedIds = reordered.map(p => p.id);
    await apiRequest("POST", `/api/projects/${projectId}/completion-report/sections/${sectionId}/reorder`, { orderedIds });
    invalidate();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/completion-report/export`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Server error ${res.status}${msg ? `: ${msg}` : ""}`);
      }
      const ct = res.headers.get("Content-Type") ?? "";
      if (!ct.includes("presentationml")) {
        throw new Error(`Unexpected content type: ${ct}`);
      }
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Received empty file from server");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (project.name ?? "report").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      a.download = match?.[1] ?? `${safeName}_completion_report.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast({ title: "PPTX exported successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Export error:", err);
      toast({ title: t.compRptExportFailed, description: msg, variant: "destructive" });
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

  const sections = report.sections ?? [];
  const drawingSections = report.drawingSections ?? [];

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Export button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{t.compRptTitle}</h2>
          <p className="text-sm text-slate-500">{t.compRptSubtitle}</p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting}
          className="bg-brand-700 hover:bg-brand-800 text-white gap-2"
          data-testid="button-export-pptx"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {t.compRptExportBtn}
        </Button>
      </div>

      {/* Slide 1 – Cover (auto) */}
      <SlideSection label={t.compRptSlide1Label} title={t.compRptSlide1Title} icon={<FileText className="w-4 h-4" />} defaultOpen>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
          <InfoRow label={t.compRptFieldProjectName} value={project.name} />
          <InfoRow label={t.compRptFieldPoNumber}    value={project.poNumber ?? project.code} />
        </div>
        <p className="text-xs text-slate-400 mt-2">{t.compRptAutoFilled}</p>
      </SlideSection>

      {/* Slide 2 – Work Final Report */}
      <SlideSection label={t.compRptSlide2Label} title={t.compRptSlide2Title} icon={<FileText className="w-4 h-4" />} defaultOpen>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
            <InfoRow label={t.compRptFieldProjectName} value={project.name} />
            <InfoRow label={t.compRptFieldPoNumber}    value={project.poNumber ?? project.code} />
            <InfoRow label={t.compRptFieldCompanyName} value="TK ELECTRIC LLC." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">{t.compRptFieldContractItem}</Label>
              <Input
                defaultValue={report.contractItem ?? "Electric Works"}
                onBlur={e => updateMut.mutate({ contractItem: e.target.value })}
                placeholder="Electric Works"
                data-testid="input-contract-item"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">{t.compRptFieldCompletionDate}</Label>
              <Input
                type="date"
                defaultValue={report.completionDate ?? ""}
                onChange={e => updateMut.mutate({ completionDate: e.target.value })}
                data-testid="input-completion-date"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">{t.compRptFieldWorkDesc}</Label>
            <Textarea
              key={report.id}
              defaultValue={report.workDescription ?? ""}
              onBlur={e => updateMut.mutate({ workDescription: e.target.value })}
              placeholder={"- Install 480V, 100A, 3P electrical panel…\n- Install eight (8) L8-30R receptacles…"}
              rows={4}
              data-testid="textarea-work-description"
            />
            <p className="text-xs text-slate-400">{t.compRptWorkDescHint}</p>
          </div>
        </div>
      </SlideSection>

      {/* Slide 3 – Quotation */}
      <SlideSection label={t.compRptSlide3Label} title={t.compRptSlide3Title} icon={<Image className="w-4 h-4" />} defaultOpen>
        <ImageUploadBox
          label={t.compRptUploadQuotation}
          hint={t.compRptUploadQuotationHint}
          currentUrl={report.quotationImageUrl}
          onUpload={(f, page) => handleUpload("quotation", f, page)}
          onGetPdfPageCount={getPdfPageCount}
          onGetPdfPreview={getPdfPreview}
          onRemove={() => updateMut.mutate({ quotationImageUrl: null })}
          testId="upload-quotation"
          acceptPdf
        />
      </SlideSection>

      {/* Drawing Sections (dynamic, one slide each) */}
      {drawingSections.map((ds, dsIdx) => (
        <DrawingSectionCard
          key={ds.id}
          section={ds}
          slideLabel={`Slide ${3 + dsIdx + 1}`}
          canDelete={drawingSections.length > 1}
          onUpload={(file, page) => handleDrawingSectionUpload(ds.id, file, page)}
          onGetPdfPageCount={getPdfPageCount}
          onGetPdfPreview={getPdfPreview}
          onRemove={() => updateDrawingSectionMut.mutate({ id: ds.id, data: { imageUrl: null } })}
          onUpdateTitle={(title) => updateDrawingSectionMut.mutate({ id: ds.id, data: { title } })}
          onDeleteSection={() => deleteDrawingSectionMut.mutate(ds.id)}
        />
      ))}

      {/* Add Drawing Section button */}
      <button
        onClick={() => addDrawingSectionMut.mutate()}
        disabled={addDrawingSectionMut.isPending}
        data-testid="button-add-drawing-section"
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/30 transition-colors"
      >
        {addDrawingSectionMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {t.compRptAddDrawingSection}
      </button>

      {/* Photo Sections */}
      {sections.map((section, sIdx) => (
        <PhotoSectionCard
          key={section.id}
          section={section}
          slideLabel={`Slide ${4 + drawingSections.length + sIdx}+`}
          sensors={sensors}
          onUpload={(file) => handleSectionPhotoUpload(section.id, file)}
          onDelete={(photoId) => deleteMut.mutate(photoId)}
          onMetaChange={(photoId, field, val) => handlePhotoMeta(photoId, field, val)}
          onCropFocusChange={(photoId, focus) => handleCropFocusChange(photoId, focus)}
          onCropChange={(photoId, coords) => handleCropChange(photoId, coords)}
          onReorder={(photos, fromIdx, toIdx) => handleReorder(section.id, photos, fromIdx, toIdx)}
          onDragEnd={(event) => handleDragEnd(section.id, section.photos, event)}
          onUpdateTitle={(title) => updateSectionMut.mutate({ id: section.id, data: { title } })}
          onDeleteSection={() => {
            if (sections.length <= 1) {
              toast({ title: t.compRptCannotDelete, description: t.compRptCannotDeleteDesc, variant: "destructive" });
              return;
            }
            deleteSectionMut.mutate(section.id);
          }}
          canDelete={sections.length > 1}
        />
      ))}

      {/* Add Section button */}
      <button
        onClick={() => addSectionMut.mutate()}
        disabled={addSectionMut.isPending}
        data-testid="button-add-section"
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/30 transition-colors"
      >
        {addSectionMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {t.compRptAddSection}
      </button>

    </div>
  );
}

// ── DrawingSectionCard ───────────────────────────────────────────────────────

function DrawingSectionCard({
  section, slideLabel, canDelete, onUpload, onGetPdfPageCount, onGetPdfPreview,
  onRemove, onUpdateTitle, onDeleteSection,
}: {
  section: DrawingSection;
  slideLabel: string;
  canDelete: boolean;
  onUpload: (f: File, pdfPage?: number) => Promise<void>;
  onGetPdfPageCount?: (f: File) => Promise<number>;
  onGetPdfPreview?: (f: File, page: number) => Promise<string>;
  onRemove: () => void;
  onUpdateTitle: (title: string) => void;
  onDeleteSection: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);

  function commitTitle() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== section.title) onUpdateTitle(trimmed);
    setEditingTitle(false);
  }
  function cancelTitle() {
    setTitleDraft(section.title);
    setEditingTitle(false);
  }

  return (
    <div className="premium-card bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100 shrink-0">
          {slideLabel}
        </span>
        <Image className="w-4 h-4 text-slate-400 shrink-0" />

        {editingTitle ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") cancelTitle(); }}
              className="flex-1 min-w-0 border border-brand-400 rounded px-2 py-0.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
              data-testid={`input-drawing-section-title-${section.id}`}
            />
            <button onClick={commitTitle} className="text-brand-600 hover:text-brand-800 p-0.5" data-testid={`button-drawing-title-confirm-${section.id}`}><Check className="w-4 h-4" /></button>
            <button onClick={cancelTitle} className="text-slate-400 hover:text-slate-600 p-0.5" data-testid={`button-drawing-title-cancel-${section.id}`}><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-slate-700 font-semibold text-sm truncate">{section.title}</span>
            <button
              onClick={() => { setTitleDraft(section.title); setEditingTitle(true); }}
              className="text-slate-300 hover:text-slate-500 p-0.5 shrink-0"
              data-testid={`button-drawing-section-title-edit-${section.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {canDelete && (
            <button
              onClick={onDeleteSection}
              className="text-slate-300 hover:text-red-500 p-1 transition-colors"
              data-testid={`button-delete-drawing-section-${section.id}`}
              title={t.compRptDeleteDrawingSection}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="text-slate-400 hover:text-slate-600 p-1"
            data-testid={`button-drawing-section-collapse-${section.id}`}
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="p-4">
          <ImageUploadBox
            label={t.compRptUploadDrawing}
            currentUrl={section.imageUrl}
            onUpload={onUpload}
            onGetPdfPageCount={onGetPdfPageCount}
            onGetPdfPreview={onGetPdfPreview}
            onRemove={onRemove}
            testId={`upload-drawing-section-${section.id}`}
            acceptPdf
          />
        </div>
      )}
    </div>
  );
}

// ── PhotoSectionCard ────────────────────────────────────────────────────────

function PhotoSectionCard({
  section, slideLabel, sensors, onUpload, onDelete, onMetaChange, onCropFocusChange, onCropChange, onReorder, onDragEnd,
  onUpdateTitle, onDeleteSection, canDelete,
}: {
  section: PhotoSection;
  slideLabel: string;
  sensors: any;
  onUpload: (file: File) => Promise<void>;
  onDelete: (photoId: number) => void;
  onMetaChange: (photoId: number, field: "photoDate" | "description", val: string) => void;
  onCropFocusChange: (photoId: number, focus: CropFocus) => void;
  onCropChange: (photoId: number, coords: { cropX: number; cropY: number; cropWidth: number; cropHeight: number } | null) => void;
  onReorder: (photos: Photo[], fromIdx: number, toIdx: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onUpdateTitle: (title: string) => void;
  onDeleteSection: () => void;
  canDelete: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const photos = section.photos ?? [];

  function commitTitle() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== section.title) onUpdateTitle(trimmed);
    setEditingTitle(false);
  }

  function cancelTitle() {
    setTitleDraft(section.title);
    setEditingTitle(false);
  }

  return (
    <div className="premium-card bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100 shrink-0">
          {slideLabel}
        </span>
        <Camera className="w-4 h-4 text-slate-400 shrink-0" />

        {/* Editable title */}
        {editingTitle ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") cancelTitle(); }}
              className="flex-1 min-w-0 border border-brand-400 rounded px-2 py-0.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
              data-testid={`input-section-title-${section.id}`}
            />
            <button onClick={commitTitle} className="text-brand-600 hover:text-brand-800 p-0.5" data-testid={`button-section-title-confirm-${section.id}`}><Check className="w-4 h-4" /></button>
            <button onClick={cancelTitle} className="text-slate-400 hover:text-slate-600 p-0.5" data-testid={`button-section-title-cancel-${section.id}`}><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-slate-700 font-semibold text-sm truncate">{section.title}</span>
            <button
              onClick={() => { setTitleDraft(section.title); setEditingTitle(true); }}
              className="text-slate-300 hover:text-slate-500 p-0.5 shrink-0"
              data-testid={`button-section-title-edit-${section.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {/* Auto layout indicator */}
          <span
            className="text-xs text-slate-400 hidden sm:inline"
            title={t.compRptLayoutAutoTooltip}
            data-testid={`label-section-${section.id}-layout`}
          >
            {t.compRptLayoutAuto}
          </span>

          {/* Delete section */}
          {canDelete && (
            <button
              onClick={onDeleteSection}
              className="text-slate-300 hover:text-red-500 p-1 transition-colors"
              data-testid={`button-delete-section-${section.id}`}
              title={t.compRptDeleteSection}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setOpen(o => !o)}
            className="text-slate-400 hover:text-slate-600 p-1"
            data-testid={`button-section-collapse-${section.id}`}
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Section body */}
      {open && (
        <div className="p-4 space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
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
                    onDelete={() => onDelete(photo.id)}
                    onMetaChange={(field, val) => onMetaChange(photo.id, field, val)}
                    onCropFocusChange={(focus) => onCropFocusChange(photo.id, focus)}
                    onCropChange={(coords) => onCropChange(photo.id, coords)}
                    onMoveUp={() => onReorder(photos, idx, idx - 1)}
                    onMoveDown={() => onReorder(photos, idx, idx + 1)}
                  />
                ))}
                <AddPhotoBox onAdd={onUpload} />
              </div>
            </SortableContext>
          </DndContext>
          <p className="text-xs text-slate-400">{t.compRptDragHint}</p>
        </div>
      )}
    </div>
  );
}

// ── SlideSection ────────────────────────────────────────────────────────────

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

// ── ImageUploadBox ──────────────────────────────────────────────────────────

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
  const { t } = useLanguage();
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
          {" "}<span className="font-bold">{pdfPageCount}</span> {t.compRptPdfOf}
        </p>
        <div className="flex gap-4 items-start">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600 shrink-0">{t.compRptPdfUsePage}</label>
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
              <span className="text-sm text-slate-400">{t.compRptPdfOf} {pdfPageCount}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmPage}
                disabled={uploading}
                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-60"
                data-testid={`${testId}-confirm-page`}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {t.compRptPdfUsePage} {selectedPage}
              </button>
              <button
                onClick={cancelPicker}
                disabled={uploading}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                data-testid={`${testId}-cancel-page`}
              >
                {t.compRptPdfCancel}
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
              <span className="text-xs text-slate-400 text-center px-2">{t.compRptPreviewLoading}</span>
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
          <p className="text-xs text-slate-400 mt-1">{t.compRptClickToBrowse}</p>
        </>
      }
    </div>
  );
}

// ── CropEditorModal ──────────────────────────────────────────────────────────

const PPT_ASPECT = 4.50 / 2.29; // ~1.965 — matches PPT slide cell ratio

function CropEditorModal({
  photo,
  open,
  onClose,
  onApply,
}: {
  photo: Photo;
  open: boolean;
  onClose: () => void;
  onApply: (coords: { cropX: number; cropY: number; cropWidth: number; cropHeight: number } | null) => void;
}) {
  const { t } = useLanguage();
  const [cropperKey, setCropperKey] = useState(0);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [completedArea, setCompletedArea] = useState<Area | null>(null);

  const hasSavedCrop =
    photo.cropX != null && photo.cropWidth != null && Number(photo.cropWidth) > 0;
  const initZoom = hasSavedCrop ? Math.max(1, 100 / Number(photo.cropWidth)) : 1;
  const initAreaPct: Area | undefined = hasSavedCrop
    ? {
        x: Number(photo.cropX),
        y: Number(photo.cropY),
        width: Number(photo.cropWidth),
        height: Number(photo.cropHeight),
      }
    : undefined;

  useEffect(() => {
    if (!open) return;
    setZoom(initZoom);
    setCropPos({ x: 0, y: 0 });
    setCompletedArea(null);
    setCropperKey((k) => k + 1);
  }, [open]);

  function handleApply() {
    if (!completedArea) return;
    onApply({
      cropX: completedArea.x,
      cropY: completedArea.y,
      cropWidth: completedArea.width,
      cropHeight: completedArea.height,
    });
    onClose();
  }

  function handleReset() {
    onApply(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="w-4 h-4 text-brand-600" />
            {t.compRptCropModalTitle}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-xs text-slate-500 -mt-1">{t.compRptCropHint}</DialogDescription>

        {/* react-easy-crop: fixed crop box, image pans/zooms beneath it.
            Guard with `open` so the Cropper unmounts immediately on close
            instead of staying alive during the Dialog exit animation. */}
        <div className="relative rounded-lg overflow-hidden bg-slate-900" style={{ height: "55vh" }}>
          {open && (
            <Cropper
              key={cropperKey}
              image={photo.photoUrl}
              crop={cropPos}
              zoom={zoom}
              aspect={PPT_ASPECT}
              minZoom={0.5}
              maxZoom={5}
              onCropChange={setCropPos}
              onZoomChange={setZoom}
              onCropComplete={(croppedArea) => setCompletedArea(croppedArea)}
              initialCroppedAreaPercentages={initAreaPct}
              style={{
                containerStyle: { borderRadius: "8px" },
              }}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-2 px-1">
          <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-brand-600 cursor-pointer"
            aria-label={t.compRptCropZoom}
            data-testid={`slider-crop-zoom-${photo.id}`}
          />
          <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-500 w-9 text-right tabular-nums shrink-0">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            data-testid={`button-crop-reset-${photo.id}`}
          >
            {t.compRptCropReset}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} data-testid={`button-crop-cancel-${photo.id}`}>
              {t.cmnCancel}
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!completedArea}
              className="bg-brand-600 hover:bg-brand-700 text-white"
              data-testid={`button-crop-apply-${photo.id}`}
            >
              {t.compRptCropApply}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── PhotoCard ───────────────────────────────────────────────────────────────

function PhotoCard({
  photo, index, isFirst, isLast, onDelete, onMetaChange, onCropFocusChange, onCropChange, onMoveUp, onMoveDown,
}: {
  photo: Photo;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
  onMetaChange: (field: "photoDate" | "description", val: string) => void;
  onCropFocusChange: (focus: CropFocus) => void;
  onCropChange: (coords: { cropX: number; cropY: number; cropWidth: number; cropHeight: number } | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const [showCropModal, setShowCropModal] = useState(false);

  const hasCrop =
    photo.cropX != null && photo.cropY != null &&
    photo.cropWidth != null && photo.cropHeight != null &&
    Number(photo.cropWidth) > 0 && Number(photo.cropHeight) > 0;

  // Build image style for the crop preview inside a PPT-aspect-ratio container.
  //
  // The crop editor always locks to PPT_ASPECT, so the crop rectangle satisfies:
  //   (cW / cH) * naturalAspect === PPT_ASPECT
  //
  // Substituting that identity simplifies the top-offset formula to just
  // -(cY/cH)*100 (% of container height), removing any dependency on naturalAspect.
  //
  //   imgWidth  = (100/cW) * containerWidth   → fills the cW% crop to 100% container width
  //   imgHeight = imgWidth / naturalAspect     → browser computes this via height:auto
  //   left      = -(cX/cW) * 100%             → shift crop-left to container-left
  //   top       = -(cY/cH) * 100%             → shift crop-top to container-top (% of containerHeight)
  const buildCropImgStyle = (): React.CSSProperties => {
    if (hasCrop) {
      const cX = Number(photo.cropX);
      const cY = Number(photo.cropY);
      const cW = Number(photo.cropWidth);
      const cH = Number(photo.cropHeight);
      return {
        position: "absolute",
        width:    `${(100 / cW) * 100}%`,
        height:   "auto",
        left:     `${-(cX / cW) * 100}%`,
        top:      `${-(cY / cH) * 100}%`,
      };
    }
    return {
      objectFit: "cover",
      objectPosition: {
        centre: "center center",
        top:    "center top",
        bottom: "center bottom",
        left:   "left center",
        right:  "right center",
      }[photo.cropFocus ?? "centre"] ?? "center center",
      width: "100%",
      height: "100%",
    };
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="border border-slate-200 rounded-xl overflow-hidden bg-white"
        data-testid={`photo-card-${photo.id}`}
      >
        {/* Preview: locked to PPT aspect ratio, overflow hidden to show exactly the crop */}
        <div
          className="relative overflow-hidden w-full"
          style={{ aspectRatio: "4.50/2.29" }}
        >
          <img
            src={photo.photoUrl}
            alt={`Photo ${index}`}
            style={buildCropImgStyle()}
          />
          <span className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-0.5 rounded">#{index}</span>
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              {...attributes}
              {...listeners}
              className="bg-white/90 hover:bg-slate-100 text-slate-500 rounded-full p-1.5 shadow cursor-grab active:cursor-grabbing"
              data-testid={`button-drag-${photo.id}`}
              title={t.compRptDragToReorder}
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="bg-white/90 hover:bg-slate-100 disabled:opacity-30 text-slate-700 rounded-full p-1.5 shadow"
              data-testid={`button-move-up-${photo.id}`}
              title={t.compRptMoveUp}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="bg-white/90 hover:bg-slate-100 disabled:opacity-30 text-slate-700 rounded-full p-1.5 shadow"
              data-testid={`button-move-down-${photo.id}`}
              title={t.compRptMoveDown}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="bg-white/90 hover:bg-red-50 text-red-500 rounded-full p-1.5 shadow"
              data-testid={`button-delete-photo-${photo.id}`}
              title={t.compRptDeletePhoto}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="p-3 space-y-2 bg-slate-50">
          <input
            type="text"
            defaultValue={photo.description ?? ""}
            onBlur={e => onMetaChange("description", e.target.value)}
            placeholder={t.compRptPhotoDesc}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
            data-testid={`input-photo-desc-${photo.id}`}
          />
          {/* Crop editor row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              {hasCrop ? (
                <span className="text-brand-600 font-medium">✓ {t.compRptCropEdit}</span>
              ) : (
                t.compRptCropFocus
              )}
            </span>
            <button
              onClick={() => setShowCropModal(true)}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 border border-brand-200 rounded px-2 py-0.5 hover:bg-brand-50 transition-colors"
              data-testid={`button-open-crop-${photo.id}`}
            >
              <CropIcon className="w-3 h-3" />
              {t.compRptCropEdit}
            </button>
          </div>
        </div>
      </div>

      <CropEditorModal
        photo={photo}
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        onApply={(coords) => onCropChange(coords)}
      />
    </>
  );
}

// ── AddPhotoBox ─────────────────────────────────────────────────────────────

function AddPhotoBox({ onAdd }: { onAdd: (f: File) => Promise<void> }) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setProgress({ current: 0, total: files.length });
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        await onAdd(files[i]);
      }
    } finally {
      setProgress(null);
    }
  }

  return (
    <div
      className="border-2 border-dashed border-slate-200 rounded-xl h-44 flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
      onClick={() => inputRef.current?.click()}
      data-testid="add-photo-box"
    >
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
      {progress
        ? <>
          <Loader2 className="w-6 h-6 animate-spin text-brand-500 mb-2" />
          <p className="text-xs text-brand-500 font-medium">{progress.current} / {progress.total} {t.compRptUploading}</p>
        </>
        : <>
          <Camera className="w-6 h-6 mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">{t.compRptAddPhoto}</p>
          <p className="text-xs text-slate-300 mt-0.5">{t.compRptMultipleHint}</p>
        </>
      }
    </div>
  );
}
