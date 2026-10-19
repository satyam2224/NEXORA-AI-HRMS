import { PageHeader } from '@/components/States';
import { Sparkles, Shield, Database, Bot, Users, GitBranch, Heart } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="About NEXORA AI" subtitle="An intelligent Human Resource Management System built for portfolio demonstration." />

      <div className="card mb-6 overflow-hidden">
        <div className="relative bg-slate-900 p-8 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-violet-600/20 to-transparent" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">NEXORA AI</h2>
              <p className="text-sm text-slate-300">Intelligent Human Resource Management System</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            NEXORA AI is a full-stack HRMS demonstrating modern web development, secure
            role-based access control, real-time data persistence, and genuine AI integration
            through a server-side edge function. It is built as a college placement portfolio
            project and uses synthetic demo data — no real personal employee information is stored.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Feature icon={<Bot className="h-5 w-5" />} title="Genuine AI Integration" desc="A Supabase Edge Function proxies a configurable LLM provider for RAG-based HR answers, job descriptions, report summaries, and natural-language analytics — with no API keys exposed to the client." />
        <Feature icon={<Shield className="h-5 w-5" />} title="Role-Based Security" desc="Row Level Security on every table enforces that employees see only their own records, managers see their department, and HR/admin manage the organization. Leave self-approval is blocked server-side." />
        <Feature icon={<Database className="h-5 w-5" />} title="Real Persistence" desc="PostgreSQL schema with profiles, employees, departments, attendance, leave, payroll, notifications, and HR knowledge documents — all with proper constraints and triggers." />
        <Feature icon={<Users className="h-5 w-5" />} title="Complete HR Modules" desc="Employee CRUD, attendance check-in/out, leave workflows with approvals, payroll with payslips, and analytics dashboards with Recharts visualizations." />
        <Feature icon={<GitBranch className="h-5 w-5" />} title="Production Build" desc="React + TypeScript + Vite + Tailwind CSS. Light/dark themes, responsive layouts, loading/empty/error states throughout." />
        <Feature icon={<Heart className="h-5 w-5" />} title="Portfolio Project" desc="Built for college placement demonstration. Clearly labeled as a portfolio implementation — payroll figures are illustrative and not tax/legal compliant." />
      </div>

      <div className="card mt-6 p-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Technology Stack</h3>
        <div className="flex flex-wrap gap-2">
          {['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Lucide React', 'Recharts', 'Supabase', 'PostgreSQL', 'Supabase Auth', 'Supabase Edge Functions', 'Deno'].map((t) => (
            <span key={t} className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{t}</span>
          ))}
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Disclaimer</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This is a portfolio project. All employee data is synthetic. Payroll calculations are
          illustrative and not verified for tax or legal compliance. AI features require a
          configured LLM provider (see the README for setup). The application does not make
          automated hiring, firing, promotion, or compensation decisions.
        </p>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-5">
      <div className="mb-3 inline-flex rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{icon}</div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
    </div>
  );
}
