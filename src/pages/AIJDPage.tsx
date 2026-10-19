import { useState } from 'react';
import { AI_ACTIONS } from '@/lib/ai';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/States';
import { FileText, Sparkles, Copy, Check, AlertCircle } from 'lucide-react';

export function AIJDPage() {
  const deptsQ = useQuery(() => supabase.from('departments').select('name').order('name'), []);
  const departments = (deptsQ.data as { name: string }[]) || [];

  const [form, setForm] = useState({
    job_title: '', department: '', skills: '', experience_level: 'Mid-level',
  });
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setContent('');
    const res = await AI_ACTIONS.jd(form);
    if (res.ok) setContent(res.content);
    else setError(res.error);
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="AI Job Description Generator" subtitle="Generate a professional, editable job description from a few inputs." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <form onSubmit={generate} className="space-y-4">
            <div>
              <label className="label">Job Title</label>
              <input className="input" placeholder="e.g. Senior Backend Engineer" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} required />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" list="depts" placeholder="e.g. Engineering" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              <datalist id="depts">{departments.map((d) => <option key={d.name} value={d.name} />)}</datalist>
            </div>
            <div>
              <label className="label">Required Skills (comma-separated)</label>
              <textarea className="input min-h-20" placeholder="Python, PostgreSQL, AWS, system design" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
            </div>
            <div>
              <label className="label">Experience Level</label>
              <select className="input" value={form.experience_level} onChange={(e) => setForm({ ...form, experience_level: e.target.value })}>
                <option>Entry-level</option><option>Mid-level</option><option>Senior</option><option>Lead</option><option>Manager</option>
              </select>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <><Sparkles className="h-4 w-4 animate-pulse" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate</>}
            </button>
          </form>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <FileText className="h-4 w-4" /> Generated Job Description
            </h3>
            {content && (
              <button onClick={copy} className="btn-ghost rounded-md p-1.5 text-xs">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </button>
            )}
          </div>
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {!content && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <FileText className="mb-2 h-8 w-8" />
              <p className="text-sm">Fill the form and click Generate.</p>
            </div>
          )}
          {content && (
            <textarea
              className="input min-h-[60vh] font-mono text-sm leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
