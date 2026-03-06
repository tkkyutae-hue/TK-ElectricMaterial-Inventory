import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/models/auth";

export default function UserApprovals() {
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/users/${id}/approve`),
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

  const pending = users.filter(u => u.status === "pending");
  const others = users.filter(u => u.status !== "pending");

  function statusBadge(status: string | null | undefined) {
    if (status === "active") return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
    if (status === "rejected") return <Badge className="bg-red-100 text-red-600 border-red-200">Rejected</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-700" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-700" />
          User Approvals
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage user access requests and account statuses.</p>
      </div>

      {/* Pending section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Pending Approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            No pending approvals
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(u => (
              <div
                key={u.id}
                className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between gap-4"
                data-testid={`row-user-${u.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{u.name ?? "—"}</p>
                  <p className="text-sm text-slate-500 truncate">{u.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Requested {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(u.id)}
                    disabled={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
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
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                    data-testid={`btn-reject-${u.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All users section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
          All Users ({users.length})
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} data-testid={`row-all-user-${u.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name ?? u.firstName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={u.role === "admin" ? "border-amber-300 text-amber-700" : ""}>
                      {u.role ?? "staff"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3">
                    {u.status !== "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => approveMutation.mutate(u.id)}
                        className="text-green-600 h-7 px-2 text-xs"
                      >
                        Approve
                      </Button>
                    )}
                    {u.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rejectMutation.mutate(u.id)}
                        className="text-red-500 h-7 px-2 text-xs"
                      >
                        Reject
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
