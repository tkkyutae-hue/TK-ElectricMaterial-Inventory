import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, Link2, Link2Off, RefreshCw, Check, X, Loader2,
  User, Badge as BadgeIcon, AlertCircle, CheckCircle2,
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
  employeeNumber?: string;
  email?: string;
}

interface MappingRow {
  person: JibblePerson;
  worker: Worker | null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JibbleIntegration() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [clientId, setClientId]         = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret]     = useState(false);

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
      toast({ title: "Jibble 연결 해제됨" });
    },
  });

  // ── Sync mutation ──
  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jibble/sync"),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/jibble/status"] });
      qc.invalidateQueries({ queryKey: ["/api/workers"] });
      toast({ title: "동기화 완료", description: `활성 펀치인: ${data.activePunchIns ?? 0}명` });
    },
    onError: (err: any) => {
      toast({ title: "동기화 실패", description: err.message, variant: "destructive" });
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

  // ── Build mapping rows ──
  const mappingRows: MappingRow[] = members.map((person) => {
    const matched = workers.find((w) => w.jibblePersonId === person.uid) ?? null;
    return { person, worker: matched };
  });

  const mappedCount = mappingRows.filter((r) => r.worker).length;

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
                        사번
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

                        {/* Employee number from Jibble */}
                        <td className="px-5 py-3 text-slate-500 text-xs font-mono">
                          {person.employeeNumber ?? "—"}
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

    </div>
  );
}
