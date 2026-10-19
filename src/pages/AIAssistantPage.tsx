import { useState, useRef, useEffect } from 'react';
import { AI_ACTIONS } from '@/lib/ai';
import { PageHeader } from '@/components/States';
import { Sparkles, Send, Bot, User, FileText, BarChart3, Lightbulb, AlertCircle } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string; sources?: string[] };

const SUGGESTIONS = [
  'What is the remote work policy?',
  'How do I apply for leave?',
  'What are the attendance rules?',
  'Explain the payroll cycle.',
];

export function AIAssistantPage() {
  const [mode, setMode] = useState<'chat' | 'summarize' | 'analytics'>('chat');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null);
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    const res = await AI_ACTIONS.chat(q);
    if (res.ok) {
      setMessages((m) => [...m, { role: 'assistant', content: res.answer, sources: res.sources }]);
    } else {
      setError(res.error);
      setMessages((m) => [...m, { role: 'assistant', content: `I couldn't answer that. ${res.error}` }]);
    }
    setLoading(false);
  };

  const runTask = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      if (mode === 'summarize') {
        const res = await AI_ACTIONS.summarize('last 30 days');
        if (res.ok) setResult({ type: 'summarize', ...res });
        else setError(res.error);
      } else if (mode === 'analytics') {
        if (!input.trim()) { setError('Ask a question first.'); setLoading(false); return; }
        const res = await AI_ACTIONS.analytics(input);
        if (res.ok) setResult({ type: 'analytics', ...res });
        else setError(res.error);
        setInput('');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="AI HR Assistant" subtitle="Ask about HR policies, summarize reports, or query workforce analytics in natural language." />

      <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <ModeBtn active={mode === 'chat'} onClick={() => setMode('chat')} icon={<Bot className="h-4 w-4" />}>Knowledge Assistant</ModeBtn>
        <ModeBtn active={mode === 'summarize'} onClick={() => setMode('summarize')} icon={<FileText className="h-4 w-4" />}>Report Summarizer</ModeBtn>
        <ModeBtn active={mode === 'analytics'} onClick={() => setMode('analytics')} icon={<BarChart3 className="h-4 w-4" />}>NL Analytics</ModeBtn>
      </div>

      <div className="card overflow-hidden">
        {mode === 'chat' && (
          <div className="flex h-[60vh] flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-white">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Ask me anything about HR</h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">I answer using your company's configured HR policy documents. If I don't know, I'll say so.</p>
                  <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => sendChat(s)} className="btn-secondary justify-start text-xs">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.role === 'user' ? 'bg-slate-200 text-slate-600 dark:bg-slate-700' : 'bg-gradient-to-br from-blue-500 to-violet-600 text-white'}`}>
                    {m.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                  <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'}`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.sources && m.sources.length > 0 && (
                      <p className={`mt-2 text-xs ${m.role === 'user' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        Sources: {m.sources.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white"><Sparkles className="h-4 w-4 animate-pulse" /></div>
                  <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-500 dark:bg-slate-800">Thinking…</div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="border-t border-slate-200 p-3 dark:border-slate-800">
              <form onSubmit={(e) => { e.preventDefault(); sendChat(input); }} className="flex gap-2">
                <input className="input" placeholder="Ask about HR policies…" value={input} onChange={(e) => setInput(e.target.value)} disabled={loading} />
                <button type="submit" disabled={loading || !input.trim()} className="btn-primary"><Send className="h-4 w-4" /></button>
              </form>
            </div>
          </div>
        )}

        {mode === 'summarize' && (
          <div className="p-6">
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Generate a summary of attendance and leave data from the last 30 days. The AI uses only authorized aggregate data and cites the date range used.</p>
            <button onClick={runTask} disabled={loading} className="btn-primary">
              {loading ? <><Sparkles className="h-4 w-4 animate-pulse" /> Summarizing…</> : <><FileText className="h-4 w-4" /> Generate Summary</>}
            </button>
          </div>
        )}

        {mode === 'analytics' && (
          <div className="p-6">
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Ask a natural-language question about your workforce. The AI answers using only pre-fetched, authorized aggregate data — it cannot execute SQL or access individual employee records.</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {['Summarize this month\'s attendance', 'How many pending leave requests are there?', 'What is our department distribution?'].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="btn-secondary text-xs">{s}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); runTask(); }} className="flex gap-2">
              <input className="input" placeholder="Ask a question…" value={input} onChange={(e) => setInput(e.target.value)} />
              <button type="submit" disabled={loading} className="btn-primary"><Send className="h-4 w-4" /></button>
            </form>
          </div>
        )}
      </div>

      {(mode === 'summarize' || mode === 'analytics') && error && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {(mode === 'summarize' || mode === 'analytics') && result && (
        <div className="mt-4 card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Result</h3>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{result.summary || result.answer}</p>
          {result.data_range && <p className="mt-3 text-xs text-slate-400">Date range used: {result.data_range}</p>}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-400">Data used</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">{JSON.stringify(result.data_used, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ModeBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
      {icon} {children}
    </button>
  );
}
