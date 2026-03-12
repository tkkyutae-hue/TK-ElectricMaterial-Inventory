import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Users, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/models/auth";

type Tab = "pending" | "active" | "rejected";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export default function UserApprovals() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/approve`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User approved", description: "The user can now sign in." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/users/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User rejected" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setConfirmDeleteId(null);
      toast({ title: "User deleted", description: "The account has been permanently removed." });
    },
    onError: (err: any) => {
      setConfirmDeleteId(null);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = users.filter(u => u.status === tab);
  const counts = {
    pending: users.filter(u => u.status === "pending").length,
    active: users.filter(u => u.status === "active").length,
    rejected: users.filter(u => u.status === "rejected").length,
  };

  function statusBadge(status: string | null | undefined) {
    if (status === "active") return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
    return <Badge className="bg-red-100 text-red-600 border-red-200">Rejected</Badge>;
  }

  function roleBadge(role: string | null | undefined) {
    const r = role ?? "viewer";
    const cls = r === "admin"   ? "border-amber-300 text-amber-700 bg-amber-50"
      : r === "manager" ? "border-purple-200 text-purple-700 bg-purple-50"
      : r === "staff"   ? "border-blue-200 text-blue-700 bg-blue-50"
      : "border-slate-200 text-slate-600 bg-slate-50";
    return <Badge variant="outline" className={cls}>{ROLE_LABELS[r] ?? r}</Badge>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-700" />
          User Approvals
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage user access requests and account statuses.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(["pending", "active", "rejected"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-testid={`tab-${t}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {counts[t] > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                t === "pending" ? "bg-amber-100 text-amber-700"
                : t === "active" ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-600"
              }`}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          No {tab} users
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div
              key={u.id}
              className={`bg-white rounded-xl border p-4 ${
                tab === "pending" ? "border-amber-200" : "border-slate-200"
              }`}
              data-testid={`row-user-${u.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{u.name ?? "—"}</p>
                    {roleBadge(u.role)}
                    {statusBadge(u.status)}
                  </div>
                  <p className="text-sm text-slate-500">{u.email}</p>
                  {u.createdAt && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Joined {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  {/* Pending: role selector + approve/reject */}
                  {tab === "pending" && (
                    <>
                      <Select
                        value={pendingRoles[u.id] ?? "viewer"}
                        onValueChange={v => setPendingRoles(r => ({ ...r, [u.id]: v }))}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs" data-testid={`select-role-${u.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ id: u.id, role: pendingRoles[u.id] ?? "viewer" })}
                        disabled={approveMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-8"
                        data-testid={`btn-approve-${u.id}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMutation.mutate(u.id)}
                        disabled={rejectMutation.isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 h-8"
                        data-testid={`btn-reject-${u.id}`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </>
                  )}

                  {/* Active: change role + deactivate */}
                  {tab === "active" && (
                    <>
                      <Select
                        value={u.role ?? "viewer"}
                        onValueChange={v => patchMutation.mutate({ id: u.id, data: { role: v } })}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs" data-testid={`select-role-active-${u.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patchMutation.mutate({ id: u.id, data: { status: "rejected" } })}
                        disabled={patchMutation.isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                        data-testid={`btn-deactivate-${u.id}`}
                      >
                        Deactivate
                      </Button>
                    </>
                  )}

                  {/* Rejected: re-activate + delete */}
                  {tab === "rejected" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patchMutation.mutate({ id: u.id, data: { status: "active" } })}
                        disabled={patchMutation.isPending}
                        className="text-green-600 border-green-200 hover:bg-green-50 h-8"
                        data-testid={`btn-reactivate-${u.id}`}
                      >
                        Re-activate
                      </Button>
                      {confirmDeleteId === u.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(u.id)}
                            disabled={deleteMutation.isPending}
                            className="text-[11px] font-semibold text-red-600 hover:text-red-800 whitespace-nowrap"
                            data-testid={`btn-confirm-delete-${u.id}`}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] text-slate-400 hover:text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDeleteId(u.id)}
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                          data-testid={`btn-delete-${u.id}`}
                          title="Delete user permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
