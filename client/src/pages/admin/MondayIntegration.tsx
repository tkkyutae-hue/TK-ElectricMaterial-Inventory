import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  RefreshCw, Unplug, Plug, AlertCircle, CheckCircle2, ExternalLink, Info,
  Settings, ChevronDown, ChevronUp, AlertTriangle, Save, Eye, Link2, SkipForward,
} from "lucide-react";

type ConflictItem = {
  mondayItemId: string;
  mondayName: string;
  poNumber: string | null;
  existingProjects: Array<{ id: number; name: string; customerName: string | null }>;
};

type Resolution = {
  action: "link" | "skip";
  existingProjectId?: number;
};

type Status = {
  hasToken: boolean;
  boardId: string | null;
  boardName: string | null;
  webhookCount: number;
  isConnected: boolean;
};

type Board = { id: string; name: string };
type Column = { id: string; title: string; type: string };

type ColumnMapping = {
  projectNameColumnId?: string | null;
  statusColumnId?: string | null;
  contactColumnId?: string | null;
  timelineColumnId?: string | null;
  locationColumnId?: string | null;
  notesColumnId?: string | null;
};

const REQUIRED_MAPPING_KEYS: (keyof ColumnMapping)[] = [
  "projectNameColumnId",
  "statusColumnId",
  "contactColumnId",
  "timelineColumnId",
  "locationColumnId",
];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  projectNameColumnId: "프로젝트명 (PROJECT NAME / REMARK)",
  statusColumnId: "상태 (Status)",
  contactColumnId: "담당자 / 연락처 (Contact)",
  timelineColumnId: "일정 / 기간 (Timeline / Date)",
  locationColumnId: "위치 / 현장 (Location)",
  notesColumnId: "메모 / 노트 (Notes) — 선택",
};

function isMappingComplete(m: ColumnMapping | null | undefined): boolean {
  if (!m) return false;
  return REQUIRED_MAPPING_KEYS.every(k => !!(m as any)[k]);
}

export default function MondayIntegration() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedBoardName, setSelectedBoardName] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [localMapping, setLocalMapping] = useState<ColumnMapping>({});
  const [mappingDirty, setMappingDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictItem[] | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});

  // ── Status ────────────────────────────────────────────────────────────────
  const { data: statusData, isLoading: statusLoading } = useQuery<Status>({
    queryKey: ["/api/monday/status"],
  });
  const isConnected = statusData?.isConnected ?? false;

  // ── Boards list ───────────────────────────────────────────────────────────
  const { data: boardsData, isLoading: boardsLoading, refetch: refetchBoards } = useQuery<{ boards: Board[] }>({
    queryKey: ["/api/monday/boards"],
    enabled: !!(statusData?.hasToken && !isConnected),
  });

  // ── Column list ───────────────────────────────────────────────────────────
  const { data: columnsData, isLoading: columnsLoading, refetch: refetchColumns } = useQuery<{ columns: Column[] }>({
    queryKey: ["/api/monday/columns"],
    enabled: !!(isConnected && showSettings),
  });
  const columns = columnsData?.columns ?? [];

  // ── Saved mapping ─────────────────────────────────────────────────────────
  const { data: savedMappingData } = useQuery<{ mapping: ColumnMapping | null }>({
    queryKey: ["/api/monday/column-mapping"],
    enabled: isConnected,
  });

  useEffect(() => {
    if (savedMappingData?.mapping && !mappingDirty) {
      setLocalMapping(savedMappingData.mapping);
    }
  }, [savedMappingData]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const connectMutation = useMutation({
    mutationFn: async () => {
      const webhookBaseUrl = window.location.origin;
      return apiRequest("POST", "/api/monday/connect", { boardId: selectedBoardId, boardName: selectedBoardName, webhookBaseUrl });
    },
    onSuccess: async (res: any) => {
      const data = await res.json();
      if (data.columnMapping) setLocalMapping(data.columnMapping);
      qc.invalidateQueries({ queryKey: ["/api/monday/status"] });
      qc.invalidateQueries({ queryKey: ["/api/monday/column-mapping"] });
      if (data.conflicts?.length > 0) {
        setConflictData(data.conflicts);
        const init: Record<string, Resolution> = {};
        for (const c of data.conflicts) {
          init[c.mondayItemId] = { action: "link", existingProjectId: c.existingProjects[0]?.id };
        }
        setResolutions(init);
        toast({ title: "PO 충돌 감지됨", description: `${data.conflicts.length}건의 PO 중복을 확인해주세요` });
        return;
      }
      toast({ title: "Monday.com 연결 완료", description: `${data.synced ?? 0}개 프로젝트 동기화, Webhook ${data.webhookCount}개 등록됨` });
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "연결 실패", description: err.message }),
  });

  const saveMappingMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/monday/column-mapping", { mapping: localMapping }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({ title: "매핑 저장됨", description: data.complete ? "필수 매핑 완료 — Sync Now 사용 가능" : "일부 필수 매핑이 누락되어 있습니다" });
      setMappingDirty(false);
      qc.invalidateQueries({ queryKey: ["/api/monday/column-mapping"] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "저장 실패", description: err.message }),
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/monday/sync"),
    onSuccess: async (res: any) => {
      const data = await res.json();
      if (data.conflicts?.length > 0) {
        setConflictData(data.conflicts);
        const init: Record<string, Resolution> = {};
        for (const c of data.conflicts) {
          init[c.mondayItemId] = { action: "link", existingProjectId: c.existingProjects[0]?.id };
        }
        setResolutions(init);
        toast({ title: "PO 충돌 감지됨", description: `${data.conflicts.length}건의 PO 중복을 확인해주세요` });
        return;
      }
      toast({ title: "동기화 완료", description: `${data.synced}개 항목 업데이트됨` });
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: async (err: any) => {
      try {
        const body = await (err as any).response?.json?.();
        if (body?.mappingIncomplete) {
          toast({ variant: "destructive", title: "동기화 불가", description: "컬럼 매핑을 먼저 완료해주세요 (Settings → Column Mapping)" });
          return;
        }
      } catch {}
      toast({ variant: "destructive", title: "동기화 실패", description: err.message });
    },
  });

  const resolveConflictsMutation = useMutation({
    mutationFn: (resolutionList: Array<{ mondayItemId: string; action: string; existingProjectId?: number }>) =>
      apiRequest("POST", "/api/monday/sync/resolve-conflicts", { resolutions: resolutionList }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setConflictData(null);
      setResolutions({});
      toast({ title: "동기화 완료", description: `${data.synced}개 항목 처리됨` });
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "동기화 실패", description: err.message }),
  });

  function submitConflictResolutions() {
    if (!conflictData) return;
    const list = conflictData.map(c => {
      const r = resolutions[c.mondayItemId] ?? { action: "skip" };
      return {
        mondayItemId: c.mondayItemId,
        action: r.action,
        existingProjectId: r.action === "link" ? r.existingProjectId : undefined,
      };
    });
    resolveConflictsMutation.mutate(list);
  }

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/monday/disconnect"),
    onSuccess: () => {
      toast({ title: "연결 해제됨", description: "모든 Webhook이 제거됐습니다" });
      qc.invalidateQueries({ queryKey: ["/api/monday/status"] });
      setSelectedBoardId("");
    },
    onError: (err: any) => toast({ variant: "destructive", title: "해제 실패", description: err.message }),
  });

  function autoSuggest() {
    if (!columns.length) return;
    const suggested: ColumnMapping = {};
    for (const col of columns) {
      const title = col.title.toLowerCase();
      const type = col.type.toLowerCase();
      if (!suggested.projectNameColumnId && (title.includes("project name") || title.includes("remark") || (title.includes("name") && !title.includes("person")))) {
        suggested.projectNameColumnId = col.id;
      } else if (!suggested.statusColumnId && (type === "color" || type === "status" || title === "status" || title.includes("status"))) {
        suggested.statusColumnId = col.id;
      } else if (!suggested.contactColumnId && (type === "multiple-person" || type === "person" || title.includes("contact") || title.includes("assign") || title.includes("owner"))) {
        suggested.contactColumnId = col.id;
      } else if (!suggested.timelineColumnId && (type === "timeline" || type === "date" || title.includes("timeline") || title.includes("date") || title.includes("due"))) {
        suggested.timelineColumnId = col.id;
      } else if (!suggested.locationColumnId && (title.includes("location") || title.includes("address") || title.includes("site") || title.includes("city"))) {
        suggested.locationColumnId = col.id;
      } else if (!suggested.notesColumnId && (type === "long-text" || title.includes("note") || title.includes("memo") || title.includes("remark"))) {
        suggested.notesColumnId = col.id;
      }
    }
    setLocalMapping(prev => ({ ...prev, ...suggested }));
    setMappingDirty(true);
    toast({ title: "자동 제안 적용됨", description: "매핑을 확인하고 저장하세요" });
  }

  const mappingComplete = isMappingComplete(localMapping);
  const missingFields = REQUIRED_MAPPING_KEYS.filter(k => !(localMapping as any)[k]);

  if (statusLoading) {
    return (
      <div className="p-6 flex items-center gap-3 text-slate-500">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monday.com 연동</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monday.com 보드 항목을 VoltStock 프로젝트로 실시간 동기화합니다.
        </p>
      </div>

      {/* Token status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            API 토큰 상태
            {statusData?.hasToken ? (
              <Badge className="bg-green-100 text-green-700 border-green-200">설정됨</Badge>
            ) : (
              <Badge variant="destructive">미설정</Badge>
            )}
          </CardTitle>
        </CardHeader>
        {!statusData?.hasToken && (
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>MONDAY_API_TOKEN</strong> 환경 변수가 필요합니다.
                <br />
                Monday.com → 프로필 → Developers → My Access Tokens에서 Personal API Token을 발급 후
                Replit Secrets에 <code className="bg-slate-100 px-1 rounded">MONDAY_API_TOKEN</code>으로 추가하세요.
                <br />
                <a href="https://developer.monday.com/api-reference/docs/authentication" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-1">
                  Monday.com API 토큰 발급 안내 <ExternalLink className="w-3 h-3" />
                </a>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Board connection */}
      {statusData?.hasToken && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">보드 연결</CardTitle>
            <CardDescription>
              동기화할 Monday.com 보드를 선택합니다. 그룹 = 고객사, Item = 프로젝트로 가져옵니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-800">연결됨</p>
                    <p className="text-xs text-green-700 truncate">보드: <strong>{statusData.boardName}</strong> (ID: {statusData.boardId})</p>
                    <p className="text-xs text-green-600">Webhook {statusData.webhookCount}개 활성</p>
                  </div>
                </div>

                {!mappingComplete && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800">
                      컬럼 매핑이 완료되지 않았습니다. Settings → Column Mapping을 완료해야 Sync Now를 사용할 수 있습니다.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Webhook이 활성화되어 Monday.com에서 항목 생성·수정 시 자동으로 동기화됩니다.
                    Dev 환경에서는 수동 동기화를 사용하세요.
                  </AlertDescription>
                </Alert>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending || !mappingComplete}
                    title={!mappingComplete ? "컬럼 매핑을 먼저 완료하세요" : undefined}
                    data-testid="button-monday-sync"
                  >
                    {syncMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    Sync Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowSettings(v => !v); if (!showSettings) refetchColumns(); }}
                    data-testid="button-monday-settings"
                  >
                    <Settings className="w-3.5 h-3.5 mr-1.5" />
                    Settings
                    {showSettings ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select value={selectedBoardId} onValueChange={(v) => { const board = boardsData?.boards.find(b => b.id === v); setSelectedBoardId(v); setSelectedBoardName(board?.name ?? v); }} data-testid="select-monday-board">
                      <SelectTrigger><SelectValue placeholder="보드 선택..." /></SelectTrigger>
                      <SelectContent>
                        {boardsLoading && <SelectItem value="__loading" disabled>불러오는 중...</SelectItem>}
                        {boardsData?.boards.map((board) => (
                          <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => refetchBoards()} disabled={boardsLoading} title="보드 목록 새로고침">
                    <RefreshCw className={`w-4 h-4 ${boardsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    연결 시 보드의 모든 Item이 프로젝트로 가져와집니다. 보드 그룹 = VoltStock 고객사 그룹으로 매핑됩니다.
                  </AlertDescription>
                </Alert>
                <Button onClick={() => connectMutation.mutate()} disabled={!selectedBoardId || connectMutation.isPending} data-testid="button-monday-connect">
                  {connectMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}
                  보드 연결 및 동기화
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings panel */}
      {isConnected && showSettings && (
        <>
          {/* Column Mapping */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                컬럼 매핑
                {mappingComplete
                  ? <Badge className="bg-green-100 text-green-700 border-green-200">완료</Badge>
                  : <Badge className="bg-amber-100 text-amber-700 border-amber-200">미완료</Badge>}
              </CardTitle>
              <CardDescription>
                Monday.com 컬럼과 VoltStock 필드를 연결합니다. PO/CODE는 item.name에서 자동으로 가져옵니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchColumns()} disabled={columnsLoading} data-testid="button-refresh-columns">
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${columnsLoading ? "animate-spin" : ""}`} />
                  컬럼 목록 새로고침
                </Button>
                {columns.length > 0 && (
                  <Button variant="outline" size="sm" onClick={autoSuggest} data-testid="button-auto-suggest">
                    자동 제안
                  </Button>
                )}
              </div>

              {columns.length === 0 && !columnsLoading && (
                <p className="text-sm text-slate-500">컬럼 목록을 불러오려면 위 버튼을 클릭하세요.</p>
              )}

              {columns.length > 0 && (
                <div className="space-y-3">
                  {/* PO/CODE — system field, not configurable */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-600 block mb-1">PO / CODE (고정)</label>
                      <div className="h-9 px-3 flex items-center text-sm text-slate-500 bg-slate-50 rounded-md border border-slate-200">
                        item.name (Monday Item 제목)
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-5 flex-shrink-0" />
                  </div>

                  {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map(key => {
                    const isRequired = REQUIRED_MAPPING_KEYS.includes(key);
                    const value = (localMapping as any)[key] ?? "";
                    const isFilled = !!value;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-medium text-slate-600 block mb-1">
                            {FIELD_LABELS[key]}
                            {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          <Select
                            value={value || "__none__"}
                            onValueChange={v => {
                              setLocalMapping(prev => ({ ...prev, [key]: v === "__none__" ? null : v }));
                              setMappingDirty(true);
                            }}
                            data-testid={`select-mapping-${key}`}
                          >
                            <SelectTrigger className={!isFilled && isRequired ? "border-amber-300 bg-amber-50/50" : ""}>
                              <SelectValue placeholder="컬럼 선택..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— 매핑 없음 —</SelectItem>
                              {columns.map(col => (
                                <SelectItem key={col.id} value={col.id}>
                                  {col.title} <span className="text-slate-400 text-xs ml-1">({col.type})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {isFilled
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-5 flex-shrink-0" />
                          : isRequired
                            ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-5 flex-shrink-0" />
                            : <div className="w-4 mt-5 flex-shrink-0" />}
                      </div>
                    );
                  })}

                  {!mappingComplete && missingFields.length > 0 && (
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-800">
                        필수 매핑 누락: {missingFields.map(k => FIELD_LABELS[k].split(" (")[0]).join(", ")}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 pt-1 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => saveMappingMutation.mutate()}
                      disabled={saveMappingMutation.isPending || !mappingDirty}
                      data-testid="button-save-mapping"
                    >
                      {saveMappingMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      저장
                    </Button>
                    {mappingComplete && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (showPreview) { setShowPreview(false); return; }
                          if (mappingDirty) {
                            await new Promise<void>((resolve) => {
                              saveMappingMutation.mutate(undefined, { onSuccess: () => resolve(), onError: () => resolve() });
                            });
                          }
                          setPreviewLoading(true);
                          try {
                            const res = await fetch("/api/monday/mapping-preview", { credentials: "include" });
                            if (res.ok) {
                              const data = await res.json();
                              setPreviewData(data.preview ?? []);
                              setShowPreview(true);
                            } else {
                              toast({ variant: "destructive", title: "미리보기 실패", description: "보드 데이터를 불러올 수 없습니다" });
                            }
                          } catch {
                            toast({ variant: "destructive", title: "미리보기 실패", description: "네트워크 오류가 발생했습니다" });
                          } finally {
                            setPreviewLoading(false);
                          }
                        }}
                        disabled={saveMappingMutation.isPending || previewLoading}
                        data-testid="button-mapping-preview"
                      >
                        {previewLoading ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
                        {showPreview ? "미리보기 닫기" : "미리보기 (샘플 5개)"}
                      </Button>
                    )}
                    {mappingComplete && mappingDirty && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          saveMappingMutation.mutate(undefined, {
                            onSuccess: () => syncMutation.mutate(),
                          });
                        }}
                        disabled={saveMappingMutation.isPending || syncMutation.isPending}
                        data-testid="button-save-and-sync"
                      >
                        저장 후 전체 동기화
                      </Button>
                    )}
                  </div>

                  {/* Mapping Preview */}
                  {showPreview && previewData.length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-200 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Monday 제목</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">고객 (그룹)</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">프로젝트명</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">상태</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">담당자</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">위치</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-mono text-slate-700">{row.mondayName}</td>
                              <td className="px-3 py-2 text-slate-600">{row.group || "—"}</td>
                              <td className="px-3 py-2 text-slate-700">{row.mapped.name || "—"}</td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  row.mapped.status === "active" ? "bg-green-100 text-green-700" :
                                  row.mapped.status === "completed" ? "bg-blue-100 text-blue-700" :
                                  row.mapped.status === "cancelled" ? "bg-red-100 text-red-700" :
                                  "bg-amber-100 text-amber-700"
                                }`}>
                                  {row.mapped.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{row.mapped.ownerName || "—"}</td>
                              <td className="px-3 py-2 text-slate-600">{row.mapped.jobLocation || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {showPreview && previewData.length === 0 && !previewLoading && (
                    <p className="text-xs text-slate-500 mt-2">보드에 항목이 없거나 미리보기 데이터를 불러올 수 없습니다.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-red-700">고급 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="text-red-600 border-red-200 hover:bg-red-50"
                data-testid="button-monday-disconnect"
              >
                <Unplug className="w-3.5 h-3.5 mr-1.5" />
                연결 해제 (Webhook 삭제)
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Status mapping reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">상태 매핑</CardTitle>
          <CardDescription>Monday.com 상태 레이블이 VoltStock 상태로 변환됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { monday: "Working on it", voltstock: "active", color: "bg-blue-100 text-blue-700" },
              { monday: "Quote Only", voltstock: "on_hold", color: "bg-yellow-100 text-yellow-700" },
              { monday: "Done", voltstock: "completed", color: "bg-green-100 text-green-700" },
              { monday: "Cancelled / Canceled", voltstock: "cancelled", color: "bg-red-100 text-red-700" },
              { monday: "알 수 없는 상태", voltstock: "on_hold + warning", color: "bg-slate-100 text-slate-600" },
            ].map(row => (
              <div key={row.voltstock} className="flex items-center gap-3">
                <span className="text-slate-600 flex-1">{row.monday}</span>
                <span>→</span>
                <Badge className={`${row.color} border-0`}>{row.voltstock}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PO Conflict Resolution Dialog */}
      <Dialog open={!!conflictData} onOpenChange={open => { if (!open) { setConflictData(null); setResolutions({}); } }}>
        <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              PO 번호 중복 감지됨
            </DialogTitle>
            <DialogDescription>
              아래 Monday.com 항목과 동일한 PO 번호를 가진 VoltStock 프로젝트가 이미 존재합니다.
              각 항목에 대해 <strong>기존 프로젝트에 연결</strong>하거나 <strong>이번 싱크에서 건너뛰기</strong>를 선택해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {(conflictData ?? []).map((conflict, idx) => {
              const r = resolutions[conflict.mondayItemId] ?? { action: "link", existingProjectId: conflict.existingProjects[0]?.id };
              return (
                <div key={conflict.mondayItemId} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  {/* Monday item info */}
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                      MON #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">{conflict.mondayName}</p>
                      {conflict.poNumber && (
                        <p className="text-xs text-slate-500 mt-0.5">PO: <span className="font-mono font-medium text-slate-700">{conflict.poNumber}</span></p>
                      )}
                    </div>
                  </div>

                  {/* Action choice */}
                  <RadioGroup
                    value={r.action}
                    onValueChange={(val: "link" | "skip") => {
                      setResolutions(prev => ({
                        ...prev,
                        [conflict.mondayItemId]: {
                          action: val,
                          existingProjectId: val === "link" ? (r.existingProjectId ?? conflict.existingProjects[0]?.id) : undefined,
                        },
                      }));
                    }}
                    className="space-y-2"
                  >
                    {/* Link option */}
                    <div className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors ${r.action === "link" ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                      <RadioGroupItem value="link" id={`link-${conflict.mondayItemId}`} className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`link-${conflict.mondayItemId}`} className="flex items-center gap-1.5 text-sm font-medium text-slate-800 cursor-pointer">
                          <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                          기존 프로젝트에 연결
                        </Label>
                        <p className="text-xs text-slate-500 mt-0.5">Monday 데이터로 해당 프로젝트를 업데이트하고 연결합니다.</p>
                        {r.action === "link" && conflict.existingProjects.length > 1 && (
                          <Select
                            value={String(r.existingProjectId ?? conflict.existingProjects[0]?.id)}
                            onValueChange={v => setResolutions(prev => ({
                              ...prev,
                              [conflict.mondayItemId]: { action: "link", existingProjectId: Number(v) },
                            }))}
                          >
                            <SelectTrigger className="mt-2 h-8 text-xs" data-testid={`select-link-project-${conflict.mondayItemId}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {conflict.existingProjects.map(p => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.name}{p.customerName ? ` — ${p.customerName}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {r.action === "link" && conflict.existingProjects.length === 1 && (
                          <p className="text-xs text-indigo-700 mt-1 font-medium">
                            → {conflict.existingProjects[0].name}
                            {conflict.existingProjects[0].customerName ? ` (${conflict.existingProjects[0].customerName})` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Skip option */}
                    <div className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors ${r.action === "skip" ? "border-slate-400 bg-slate-100/60" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                      <RadioGroupItem value="skip" id={`skip-${conflict.mondayItemId}`} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <Label htmlFor={`skip-${conflict.mondayItemId}`} className="flex items-center gap-1.5 text-sm font-medium text-slate-800 cursor-pointer">
                          <SkipForward className="w-3.5 h-3.5 text-slate-500" />
                          Skip (이번 싱크에서 건너뛰기)
                        </Label>
                        <p className="text-xs text-slate-500 mt-0.5">이 항목은 이번 동기화에서 처리하지 않고 건너뜁니다.</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline" size="sm"
              onClick={() => { setConflictData(null); setResolutions({}); }}
              disabled={resolveConflictsMutation.isPending}
              data-testid="btn-cancel-conflict-resolution"
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={submitConflictResolutions}
              disabled={resolveConflictsMutation.isPending}
              data-testid="btn-confirm-conflict-resolution"
            >
              {resolveConflictsMutation.isPending
                ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />처리 중...</>
                : <>동기화 완료</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
