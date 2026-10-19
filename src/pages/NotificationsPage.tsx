import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '@/components/States';
import { navigate } from '@/lib/router';
import { Bell, Check, Trash2, Info, CheckCircle, AlertTriangle } from 'lucide-react';

export function NotificationsPage() {
  const { profile } = useAuth();
  const q = useQuery(
    () => supabase.from('notifications').select('*').eq('user_id', profile?.id || '').order('created_at', { ascending: false }),
    [profile?.id]
  );

  if (q.loading) return <LoadingState message="Loading notifications…" />;
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />;

  const notifs = q.data || [];

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    q.refetch();
  };
  const markAll = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile?.id || '').eq('read', false);
    q.refetch();
  };
  const remove = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    q.refetch();
  };

  const icon = (type: string) => {
    if (type === 'success') return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (type === 'warning') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <Info className="h-5 w-5 text-blue-500" />;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on leave approvals and system activity."
        actions={notifs.some((n: any) => !n.read) && (
          <button onClick={markAll} className="btn-secondary"><Check className="h-4 w-4" /> Mark all read</button>
        )}
      />
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {notifs.length === 0 ? (
          <EmptyState icon={<Bell className="h-10 w-10" />} title="No notifications" description="You're all caught up." />
        ) : (
          notifs.map((n: any) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${n.read ? '' : 'bg-blue-50/50 dark:bg-blue-500/5'}`}>
              <div className="mt-0.5">{icon(n.type)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{n.title}</span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                </div>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1">
                {n.link && <button onClick={() => navigate(n.link!)} className="btn-ghost rounded-md p-1.5 text-xs">View</button>}
                {!n.read && <button onClick={() => markRead(n.id)} className="btn-ghost rounded-md p-1.5"><Check className="h-4 w-4" /></button>}
                <button onClick={() => remove(n.id)} className="btn-ghost rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
