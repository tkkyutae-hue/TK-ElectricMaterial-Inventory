import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw, Unplug, Plug, AlertCircle, CheckCircle2, ExternalLink, Info,
} from "lucide-react";

type Status = {
  hasToken: boolean;
  boardId: string | null;
  boardName: string | null;
  webhookId: string | null;
};

type Board = { id: string; name: string };

export default function MondayIntegration() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedBoardName, setSelectedBoardName] = useState<string>("");

  const { data: statusData, isLoading: statusLoading } = useQuery<Status>({
    queryKey: ["/api/monday/status"],
  });

  const { data: boardsData, isLoading: boardsLoading, refetch: refetchBoards } = useQuery<{ boards: Board[] }>({
    queryKey: ["/api/monday/boards"],
    enabled: !!(statusData?.hasToken && !statusData?.boardId),
  });

  const isConnected = !!(statusData?.boardId && statusData?.webhookId);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const webhookBaseUrl = window.location.origin;
      return apiRequest("POST", "/api/monday/connect", {
        boardId: selectedBoardId,
        boardName: selectedBoardName,
        webhookBaseUrl,
      });
    },
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({ title: "Monday.com 연결 완료", description: `${data.synced}개 프로젝트 동기화됨` });
      qc.invalidateQueries({ queryKey: ["/api/monday/status"] });
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "연결 실패", description: err.message });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/monday/sync"),
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({ title: "동기화 완료", description: `${data.synced}개 항목 업데이트됨` });
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "동기화 실패", description: err.message });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/monday/disconnect"),
    onSuccess: () => {
      toast({ title: "연결 해제됨" });
      qc.invalidateQueries({ queryKey: ["/api/monday/status"] });
      setSelectedBoardId("");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "해제 실패", description: err.message });
    },
  });

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
                Monday.com → 프로필 → 개발자 → API v2 토큰에서 Personal API Token을 발급 후
                Replit Secrets에 <code className="bg-slate-100 px-1 rounded">MONDAY_API_TOKEN</code>으로 추가하세요.
                <br />
                <a
                  href="https://developer.monday.com/api-reference/docs/authentication"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-1"
                >
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
              동기화할 Monday.com 보드를 선택합니다. 각 보드 Item이 하나의 프로젝트로 생성됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-800">연결됨</p>
                    <p className="text-xs text-green-700 truncate">
                      보드: <strong>{statusData.boardName}</strong> (ID: {statusData.boardId})
                    </p>
                    <p className="text-xs text-green-600">Webhook ID: {statusData.webhookId}</p>
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Webhook이 활성화되어 Monday.com에서 항목 생성·수정·삭제 시 자동으로 동기화됩니다.
                    웹훅은 배포된 환경에서만 정상 동작합니다 (Replit Dev 환경에서는 수동 동기화 사용).
                  </AlertDescription>
                </Alert>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    data-testid="button-monday-sync"
                  >
                    {syncMutation.isPending ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    수동 전체 동기화
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    data-testid="button-monday-disconnect"
                  >
                    <Unplug className="w-3.5 h-3.5 mr-1.5" />
                    연결 해제
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={selectedBoardId}
                      onValueChange={(v) => {
                        const board = boardsData?.boards.find(b => b.id === v);
                        setSelectedBoardId(v);
                        setSelectedBoardName(board?.name ?? v);
                      }}
                      data-testid="select-monday-board"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="보드 선택..." />
                      </SelectTrigger>
                      <SelectContent>
                        {boardsLoading && (
                          <SelectItem value="__loading" disabled>
                            불러오는 중...
                          </SelectItem>
                        )}
                        {boardsData?.boards.map((board) => (
                          <SelectItem key={board.id} value={board.id}>
                            {board.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetchBoards()}
                    disabled={boardsLoading}
                    title="보드 목록 새로고침"
                  >
                    <RefreshCw className={`w-4 h-4 ${boardsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    연결 시 선택한 보드의 모든 Item이 프로젝트로 가져와지며, 이후 변경사항은 Webhook으로 자동 동기화됩니다.
                    Webhook URL: <code className="bg-slate-100 px-1 rounded">{window.location.origin}/api/webhooks/monday</code>
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={!selectedBoardId || connectMutation.isPending}
                  data-testid="button-monday-connect"
                >
                  {connectMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plug className="w-4 h-4 mr-2" />
                  )}
                  보드 연결 및 동기화
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status mapping reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">상태 매핑</CardTitle>
          <CardDescription>Monday.com 컬럼 값이 VoltStock 상태로 변환됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { monday: "Done / Completed", voltstock: "completed", color: "bg-green-100 text-green-700" },
              { monday: "Stuck / On Hold / Waiting / Paused", voltstock: "on_hold", color: "bg-yellow-100 text-yellow-700" },
              { monday: "Cancelled", voltstock: "cancelled", color: "bg-red-100 text-red-700" },
              { monday: "Working on it (그 외 모든 값)", voltstock: "active", color: "bg-blue-100 text-blue-700" },
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
    </div>
  );
}
