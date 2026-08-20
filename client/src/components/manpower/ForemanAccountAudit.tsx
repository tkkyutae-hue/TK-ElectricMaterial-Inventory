import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, Link2, Loader2, ShieldCheck, Unlink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface LinkableUser {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
}

interface ForemanAuditRow {
  id: number;
  fullName: string;
  trade: string | null;
  linkedUserId: string | null;
  linkedUser: LinkableUser | null;
  todayProjectIds: number[];
  yesterdayProjectIds: number[];
}

interface ForemanAuditResponse {
  today: string;
  yesterday: string;
  foremen: ForemanAuditRow[];
}

function userLabel(user: LinkableUser) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.name || user.email || user.id;
}

function localDateStr(dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ForemanAccountAudit() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedUserByWorker, setSelectedUserByWorker] = useState<Record<number, string>>({});
  const [dateVersion, setDateVersion] = useState(0);
  const today = useMemo(() => localDateStr(), [dateVersion]);
  const yesterday = useMemo(() => localDateStr(-1), [dateVersion]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);
    const timeout = window.setTimeout(() => setDateVersion((version) => version + 1), nextMidnight.getTime() - now.getTime());
    return () => window.clearTimeout(timeout);
  }, [dateVersion]);

  const { data: audit, isLoading } = useQuery<ForemanAuditResponse>({
    queryKey: ["/api/workers/foreman-link-audit", today, yesterday],
    queryFn: async () => {
      const params = new URLSearchParams({ today, yesterday });
      const response = await fetch(`/api/workers/foreman-link-audit?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load foreman account links");
      return response.json();
    },
    refetchInterval: 30_000,
  });
  const { data: users = [] } = useQuery<LinkableUser[]>({
    queryKey: ["/api/workers/linkable-users"],
    queryFn: async () => {
      const response = await fetch("/api/workers/linkable-users", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load user accounts");
      return response.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  const foremen = audit?.foremen ?? [];
  const linkedUserIds = useMemo(
    () => new Set(foremen.map((foreman) => foreman.linkedUserId).filter((id): id is string => Boolean(id))),
    [foremen],
  );
  const sortedForemen = useMemo(() => [...foremen].sort((a, b) => {
    const priority = (foreman: ForemanAuditRow) => {
      const hasRecentDispatch = foreman.todayProjectIds.length + foreman.yesterdayProjectIds.length > 0;
      if (!foreman.linkedUserId && hasRecentDispatch) return 0;
      if (!foreman.linkedUserId) return 1;
      return 2;
    };
    return priority(a) - priority(b) || a.fullName.localeCompare(b.fullName);
  }), [foremen]);

  const linkMutation = useMutation({
    mutationFn: async ({ workerId, userId }: { workerId: number; userId: string | null }) => {
      const response = await fetch(`/api/workers/${workerId}/linked-user`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Unable to update account link" }));
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: (_updatedWorker, variables) => {
      setSelectedUserByWorker((current) => {
        const next = { ...current };
        delete next[variables.workerId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/workers/foreman-link-audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workers/linkable-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/worker"] });
      toast({ title: t.mpForemanLinkUpdated });
    },
    onError: (error: Error) => {
      toast({ title: t.cmnSaveFailed, description: error.message, variant: "destructive" });
    },
  });

  const unlinkedCount = foremen.filter((foreman) => !foreman.linkedUserId).length;
  const recentUnlinkedCount = foremen.filter(
    (foreman) => !foreman.linkedUserId && foreman.todayProjectIds.length + foreman.yesterdayProjectIds.length > 0,
  ).length;

  return (
    <Card data-testid="foreman-account-audit">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              {t.mpForemanAccountLinks}
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">{t.mpForemanAccountLinksHelp}</p>
          </div>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            {recentUnlinkedCount} {t.mpRecentUnlinkedForemen}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: t.mpForemanTotal, value: foremen.length, className: "border-slate-200 bg-slate-50 text-slate-700" },
            { label: t.mpForemanUnlinked, value: unlinkedCount, className: "border-amber-200 bg-amber-50 text-amber-700" },
            { label: t.mpRecentUnlinkedForemen, value: recentUnlinkedCount, className: "border-rose-200 bg-rose-50 text-rose-700" },
          ].map(({ label, value, className }) => (
            <div key={label} className={`rounded-lg border px-3 py-2 ${className}`}>
              <p className="text-xs font-medium">{label}</p>
              <p className="mt-0.5 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.mpLoadingWorkers}
          </div>
        ) : sortedForemen.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-7 text-center text-sm text-slate-500">
            {t.mpNoForemen}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {sortedForemen.map((foreman) => {
              const recentAssignmentCount = foreman.todayProjectIds.length + foreman.yesterdayProjectIds.length;
              const selectedUserId = selectedUserByWorker[foreman.id] ?? foreman.linkedUserId ?? "";
              const availableUsers = users.filter(
                (user) => !linkedUserIds.has(user.id) || user.id === foreman.linkedUserId,
              );
              const isSaving = linkMutation.isPending && linkMutation.variables?.workerId === foreman.id;

              return (
                <div
                  key={foreman.id}
                  data-testid={`foreman-account-row-${foreman.id}`}
                  className="grid gap-3 p-3 xl:grid-cols-[minmax(180px,1fr)_auto_minmax(250px,1.2fr)_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{foreman.fullName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{foreman.trade || "Foreman"}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {foreman.linkedUserId ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {t.mpAccountLinked}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        {t.mpForemanUnlinked}
                      </Badge>
                    )}
                    {foreman.todayProjectIds.length > 0 && (
                      <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
                        <CalendarDays className="h-3 w-3" /> {t.mpToday}: {foreman.todayProjectIds.length}
                      </Badge>
                    )}
                    {foreman.yesterdayProjectIds.length > 0 && (
                      <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 text-slate-600">
                        <CalendarDays className="h-3 w-3" /> {t.mpYesterday}: {foreman.yesterdayProjectIds.length}
                      </Badge>
                    )}
                    {recentAssignmentCount === 0 && (
                      <span className="text-xs text-slate-400">{t.mpNoRecentDispatch}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Select
                      value={selectedUserId}
                      onValueChange={(userId) => setSelectedUserByWorker((current) => ({ ...current, [foreman.id]: userId }))}
                    >
                      <SelectTrigger data-testid={`select-foreman-account-${foreman.id}`} className="h-9 text-sm">
                        <SelectValue placeholder={t.mpSelectAccount} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {userLabel(user)} {user.role ? `(${user.role})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {foreman.linkedUserId && !foreman.linkedUser && (
                      <p className="mt-1 text-xs text-amber-700">{t.mpLinkedAccountUnavailable}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      data-testid={`btn-save-foreman-account-${foreman.id}`}
                      size="sm"
                      className="h-9 gap-1.5 text-xs"
                      disabled={!selectedUserId || selectedUserId === foreman.linkedUserId || isSaving}
                      onClick={() => linkMutation.mutate({ workerId: foreman.id, userId: selectedUserId })}
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                      {t.mpLinkAccount}
                    </Button>
                    {foreman.linkedUserId && (
                      <Button
                        data-testid={`btn-clear-foreman-account-${foreman.id}`}
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-50"
                        disabled={isSaving}
                        onClick={() => linkMutation.mutate({ workerId: foreman.id, userId: null })}
                      >
                        <Unlink className="h-3.5 w-3.5" />
                        {t.mpClearAccountLink}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t.mpForemanAccountLinksSafety}</span>
        </div>
      </CardContent>
    </Card>
  );
}