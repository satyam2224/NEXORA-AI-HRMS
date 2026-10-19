import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@/lib/hooks';
import { Modal } from '@/components/Modal';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '@/components/States';
import { canManageDepartments } from '@/lib/rbac';
import type { Department } from '@/lib/types';
import { Building2, Plus, Pencil, Trash2, Users } from 'lucide-react';

export function DepartmentsPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const deptsQ = useQuery(async () => {
    const { data: depts, error } = await supabase.from('departments').select('*').order('name');
    if (error) return { data: null, error };
    const { data: counts } = await supabase.from('analytics_department_distribution').select('department_id, employee_count');
    const map: Record<string, number> = {};
    for (const c of counts || []) map[(c as any).department_id] = (c as any).employee_count;
    return { data: (depts || []).map((d) => ({ ...d, _count: map[(d as any).id] || 0 })), error };
  }, []);

  if (deptsQ.loading) return <LoadingState message="Loading departments…" />;
  if (deptsQ.error) return <ErrorState message={deptsQ.error} onRetry={deptsQ.refetch} />;

  const departments = (deptsQ.data as (Department & { _count: number })[]) || [];

  const onDelete = async (d: Department) => {
    if (!confirm(`Delete department "${d.name}"? Employees will be unassigned.`)) return;
    const { error } = await supabase.from('departments').delete().eq('id', d.id);
    if (error) alert(error.message);
    else deptsQ.refetch();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Departments"
        subtitle="Organize employees into departments."
        actions={canManageDepartments(role) && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Department
          </button>
        )}
      />

      {departments.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Building2 className="h-10 w-10" />} title="No departments yet" description="Create your first department to organize employees." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Building2 className="h-5 w-5" />
                </div>
                {canManageDepartments(role) && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(d); setModalOpen(true); }} className="btn-ghost rounded-md p-1.5"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(d)} className="btn-ghost rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{d.name}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{d.description || 'No description'}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Users className="h-3.5 w-3.5" /> {d._count} employees
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <DeptModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editing={editing}
          onSaved={() => { setModalOpen(false); deptsQ.refetch(); }}
        />
      )}
    </div>
  );
}

function DeptModal({
  open, onClose, editing, onSaved,
}: { open: boolean; onClose: () => void; editing: Department | null; onSaved: () => void }) {
  const [name, setName] = useState(editing?.name || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { name, description: description || null };
    const res = editing
      ? await supabase.from('departments').update(payload).eq('id', editing.id)
      : await supabase.from('departments').insert(payload);
    if (res.error) setError(res.error.message);
    else onSaved();
    setSaving(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Department' : 'Add Department'}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit as any} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
      </form>
    </Modal>
  );
}
