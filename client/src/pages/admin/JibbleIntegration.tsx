import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, Link2, Link2Off, RefreshCw, Check, X, Loader2,
  User, AlertCircle, CheckCircle2, Wand2, HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Worker } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JibbleStatus {
  connected: boolean;
  orgName?: string;
  lastSyncAt?: string;
  activePunchIns: number;
}

interface JibblePerson {
  uid: string;
  name: string;
  employeeCode?: string;   // live API field name
  employeeNumber?: string; // kept for backwards compat
  email?: string;
}

interface MappingRow {
  person: JibblePerson;
  worker: Worker | null;
}

interface InvalidMapping {
  workerId: number;
  workerName: string;
  jibblePersonId: string;
}

interface AutoMapSuggestion {
  jibblePersonId: string;
  jibbleName: string;
  jibbleEmployeeCode?: string;
  workerId: number;
  workerName: string;
  workerEmployeeId?: string;
  reason: string;
}

interface AutoMapResult {
  autoMapped: number;
  suggestions: AutoMapSuggestion[];
  skipped: number;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JibbleIntegration() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [clientId, setClientId]         = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret]     = useState(false);

  // Suggestions returned by auto-map (pending manual confirmation)
  const [pendingSuggestions, setPendingSuggestions] = useState<AutoMapSuggestion[]>([]);
  // IDs dismissed by the admin during this session
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  // ── Queries ──
  const { data: status, isLoading: statusLoading } = useQuery<JibbleStatus>({
    queryKey: ["/api/jibble/status"],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const { data: membersData, isLoading: membersLoading } = useQuery<{ members: JibblePerson[] }>({
    queryKey: ["/api/jibble/members"],
    enabled: !!status?.connected,
  });

  const members = membersData?.members ?? [];

  // ── Connect mutation ──
  const connectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jibble/connect", {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    }),
    onSuccess: (data: any) => {
      setClientId("");
      setClientSecret("");
      qc.invalidateQueries({ queryKey: ["/api/jibble/status"] });
      qc.invalidateQueries({ queryKey: ["/api/jibble/members"] });
      toast({ title: "Jibble 연결 완료", description: data.orgName ? `조직: ${data.orgName}` : undefined });
    },
    onError: (err: any) => {
      toast({ title: "연결 실패", description: err.message, variant: "destructive" });
    },
  });

  // ── Disconnect mutation ──
  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/jibble/connect"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jibble/status"] });
      qc.invalidateQueries({ queryKey: ["/api/jibble/members"] });
      setPendingSuggestions([]);
      setDismissedSuggestions(new Set());
      toast({ title: "Jibble 연결 해제됨" });
    },
  });

  // ── Sync mutation ──
  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jibble/sync"),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/jibble/status"] });
      qc.invalidateQueries({ queryKey: ["/api/workers"] });
      qc.invalidateQueries({ queryKey: ["/api/jibble/invalid-mappings"] });
      const parts: string[] = [`활성 펀치인: ${data.punchedIn ?? data.activePunchIns ?? 0}명`];
      if ((data.invalidPersonIds ?? 0) > 0) parts.push(`잘못된 매핑: ${data.invalidPersonIds}개`);
      if ((data.temporaryFailures ?? 0) > 0) parts.push(`일시 실패: ${data.temporaryFailures}개`);
      toast({ title: "동기화 완료", description: parts.join(" · ") });
    },
    onError: (err: any) => {
      const is503 = err?.message?.includes("일시적으로 실패");
      toast({
        title: is503 ? "동기화 일시 실패" : "동기화 실패",
        description: is503 ? "모든 Jibble 요청이 실패했습니다. 기존 상태가 유지됩니다." : err.message,
        variant: is503 ? "default" : "destructive",
      });
    },
  });

  // ── Map worker mutation ──
  const mapMutation = useMutation({
    mutationFn: ({ jibblePersonId, workerId }: { jibblePersonId: string; workerId: number | null }) =>
      apiRequest("POST", "/api/jibble/map", { jibblePersonId, workerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workers"] });
      toast({ title: "매핑 저장됨" });
    },
    onError: (err: any) => {
      toast({ title: "매핑 실패", description: err.message, variant: "destructive" });
    },
  });

  // ── Auto-map mutation ──
  const autoMapMutation = useMutation({
    mutationFn: async (): Promise<AutoMapResult> => {
      const res = await apiRequest("POST", "/api/jibble/auto-map");
      return res.json() as Promise<AutoMapResult>;
    },
    onSuccess: (data: AutoMapResult) => {
      qc.invalidateQueries({ queryKey: ["/api/workers"] });
      qc.invalidateQueries({ queryKey: ["/api/jibble/members"] });

      // Persist suggestions so admin can review them
      setPendingSuggestions(data.suggestions ?? []);
      setDismissedSuggestions(new Set());

      const parts: string[] = [];
      if (data.autoMapped > 0) parts.push(`${data.autoMapped}명 자동 매핑 완료`);
      if ((data.suggestions ?? []).length > 0)
        parts.push(`${data.suggestions.length}명 수동 확인 필요`);
      if (data.autoMapped === 0 && (data.suggestions ?? []).length === 0)
        parts.push("새로 매핑할 멤버가 없습니다");

      toast({
        title: "자동 매핑 실행됨",
        description: parts.join(" · "),
      });
    },
    onError: (err: any) => {
      toast({ title: "자동 매핑 실패", description: err.message, variant: "destructive" });
    },
  });

  // ── Apply suggestion mutation (reuse mapMutation logic) ──
  const applySuggestionMutation = useMutation({
    mutationFn: ({ jibblePersonId, workerId }: { jibblePersonId: string; workerId: number }) =>
      apiRequest("POST", "/api/jibble/map", { jibblePersonId, workerId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/workers"] });
      // Remove the applied suggestion from the list
      setPendingSuggestions((prev) => prev.filter((s) => s.jibblePersonId !== variables.jibblePersonId));
      toast({ title: "매핑 적용됨" });
    },
    onError: (err: any) => {
      toast({ title: "매핑 실패", description: err.message, variant: "destructive" });
    },
  });

  // ── Invalid mappings query ──
  const { data: invalidMappingsData } = useQuery<{ invalidMappings: InvalidMapping[] }>({
    queryKey: ["/api/jibble/invalid-mappings"],
    enabled: !!status?.connected,
  });
  const invalidMappings = invalidMappingsData?.invalidMappings ?? [];

  // ── Unmap mutation (clear invalid mapping) ──
  const unmapMutation = useMutation({
    mutationFn: (workerId: number) => apiRequest("DELETE", `/api/jibble/map/${workerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jibble/invalid-mappings"] });
      qc.invalidateQueries({ queryKey: ["/api/workers"] });
      toast({ title: "매핑 해제됨" });
    },
    onError: (err: any) => {
      toast({ title: "매핑 해제 실패", description: err.message, variant: "destructive" });
    },
  });

  // ── Build mapping rows ──
  const mappingRows: MappingRow[] = members.map((person) => {
    const matched = workers.find((w) => w.jibblePersonId === person.uid) ?? null;
    return { person, worker: matched };
  });

  const mappedCount = mappingRows.filter((r) => r.worker).length;

  // Visible suggestions — filter out dismissed ones and those already mapped via workers
  const mappedPersonIds = new Set(workers.filter((w) => w.jibblePersonId).map((w) => w.jibblePersonId as string));
  const visibleSuggestions = pendingSuggestions.filter(
    (s) => !dismissedSuggestions.has(s.jibblePersonId) && !mappedPersonIds.has(s.jibblePersonId),
  );

  function dismissSuggestion(jibblePersonId: string) {
    setDismissedSuggestions((prev) => {
      const next = new Set(prev);
      next.add(jibblePersonId);
      return next;
    });
  }

  // ── Reason label ──
  function reasonLabel(reason: string): string {
    if (reason === "employee_code") return "사번 일치";
    if (reason === "exact_name")    return "이름 일치";
    if (reason === "name_partial")  return "이름 유사";
    return reason;
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-600" />
          Jibble 연동
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Jibble의 펀치인/아웃 데이터를 맨파워 화면과 연동합니다.
        </p>
      </div>

      {/* ── Connection card ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {status?.connected
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <AlertCircle className="w-4 h-4 text-slate-400" />}
            연결 상태
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {status?.connected ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                    연결됨
                  </Badge>
                  {status.orgName && (
                    <span className="text-sm text-slate-600 font-medium">{status.orgName}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                  <span>현재 펀치인: <strong className="text-slate-600">{status.activePunchIns}명</strong></span>
                  {status.lastSyncAt && (
                    <span>마지막 동기화: {new Date(status.lastSyncAt).toLocaleString("ko-KR")}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                  지금 동기화
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  <Link2Off className="w-3.5 h-3.5" />
                  연결 해제
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Jibble 관리자 계정에서{" "}
                <a
                  href="https://app.jibble.io/account/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline underline-offset-2"
                >
                  Settings → Integrations → API
                </a>
                에서 API 키를 발급한 뒤 아래에 입력하세요.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">API 키 ID (Client ID)</label>
                  <Input
                    type="text"
                    placeholder="ba22fd1a-c3bc-4088-…"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="text-sm font-mono"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">API 키 시크릿 (Client Secret)</label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      placeholder="JwbUrOaLqrF15Pr8…"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="pr-16 text-sm font-mono"
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && clientId.trim() && clientSecret.trim()) {
                          connectMutation.mutate();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      {showSecret ? "숨기기" : "보기"}
                    </button>
                  </div>
                </div>
              </div>
              <Button
                className="gap-1.5 text-xs"
                onClick={() => connectMutation.mutate()}
                disabled={!clientId.trim() || !clientSecret.trim() || connectMutation.isPending}
              >
                {connectMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Link2 className="w-3.5 h-3.5" />}
                연결
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Member mapping ── */}
      {status?.connected && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                Jibble 멤버 → 작업자 매핑
                {members.length > 0 && (
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    ({mappedCount}/{members.length} 매핑됨)
                  </span>
                )}
              </CardTitle>
              {/* Auto-map button — only show when there are unmapped members */}
              {members.length > 0 && mappedCount < members.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:border-blue-300"
                  onClick={() => autoMapMutation.mutate()}
                  disabled={autoMapMutation.isPending || membersLoading}
                  title="이름·사번이 일치하는 작업자를 자동으로 연결합니다"
                >
                  {autoMapMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Wand2 className="w-3.5 h-3.5" />}
                  자동 매핑
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {membersLoading ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                <span className="text-sm text-slate-400">Jibble에서 멤버 목록을 불러오는 중…</span>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-400">
                Jibble 멤버가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Jibble 이름
                      </th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        연결된 작업자
                      </th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappingRows.map(({ person, worker }) => (
                      <tr key={person.uid} className="hover:bg-slate-50">
                        {/* Jibble name */}
                        <td className="px-5 py-3">
                          <span className="font-medium text-slate-800">{person.name}</span>
                          {person.email && (
                            <div className="text-xs text-slate-400">{person.email}</div>
                          )}
                        </td>

                        {/* Worker select */}
                        <td className="px-5 py-3">
                          <Select
                            value={worker?.id?.toString() ?? "__none__"}
                            onValueChange={(v) => {
                              const workerId = v === "__none__" ? null : parseInt(v);
                              mapMutation.mutate({ jibblePersonId: person.uid, workerId });
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm max-w-[220px]">
                              <SelectValue placeholder="작업자 선택…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— 연결 안 함 —</SelectItem>
                              {workers.map((w) => (
                                <SelectItem key={w.id} value={w.id.toString()}>
                                  {w.fullName}
                                  {w.employeeId ? ` (${w.employeeId})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-3 text-right">
                          {worker ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                              <Check className="w-3 h-3" /> 매핑됨
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 text-xs gap-1">
                              <X className="w-3 h-3" /> 미매핑
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Auto-map suggestions (near-matches that need manual confirmation) ── */}
      {status?.connected && visibleSuggestions.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
              <HelpCircle className="w-4 h-4" />
              매핑 제안 — 수동 확인 필요 ({visibleSuggestions.length}개)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              이름이 유사하지만 완전히 일치하지 않습니다. 맞는 경우 적용하고 틀리면 건너뜁니다.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-blue-50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Jibble 멤버</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">제안된 작업자</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">근거</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">조치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleSuggestions.map((s) => (
                    <tr key={s.jibblePersonId} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-800">{s.jibbleName}</span>
                        {s.jibbleEmployeeCode && (
                          <div className="text-xs text-slate-400">사번: {s.jibbleEmployeeCode}</div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-800">{s.workerName}</span>
                        {s.workerEmployeeId && (
                          <div className="text-xs text-slate-400">사번: {s.workerEmployeeId}</div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="text-xs text-slate-500">
                          {reasonLabel(s.reason)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="text-xs h-7 gap-1 bg-blue-600 hover:bg-blue-700"
                            onClick={() => applySuggestionMutation.mutate({
                              jibblePersonId: s.jibblePersonId,
                              workerId: s.workerId,
                            })}
                            disabled={applySuggestionMutation.isPending}
                          >
                            <Check className="w-3 h-3" />
                            적용
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 gap-1 text-slate-500"
                            onClick={() => dismissSuggestion(s.jibblePersonId)}
                          >
                            <X className="w-3 h-3" />
                            건너뜀
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Invalid mappings ── */}
      {status?.connected && invalidMappings.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-4 h-4" />
              잘못된 Jibble 연결 ({invalidMappings.length}개)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              동기화 중 Jibble 서버에서 찾을 수 없었던 직원입니다. 매핑을 해제하고 다시 연결하세요.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-amber-50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">작업자</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Jibble ID</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">조치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invalidMappings.map((m) => (
                    <tr key={m.workerId} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{m.workerName}</td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-400">
                        {m.jibblePersonId.slice(0, 8)}…
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-red-500 hover:text-red-600 hover:border-red-300 gap-1"
                          onClick={() => unmapMutation.mutate(m.workerId)}
                          disabled={unmapMutation.isPending}
                        >
                          <X className="w-3 h-3" />
                          매핑 해제
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
