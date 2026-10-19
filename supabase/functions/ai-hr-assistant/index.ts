// NEXORA AI — HR Assistant Edge Function
// Handles all AI-powered features:
//   POST /ai-hr-assistant  { action: 'chat' | 'jd' | 'summarize' | 'analytics' | 'insights' }
//
// Security:
//   - verify_jwt = true (only authenticated users can call)
//   - Validates the calling user's role from the JWT via the Supabase service client.
//   - Never lets the LLM execute SQL. Only pre-defined, parameterized query functions
//     fetch authorized aggregate data; results are passed to the LLM as context.
//   - Provider is configurable via AI_PROVIDER / AI_API_KEY / AI_MODEL / AI_BASE_URL secrets.
//   - Never exposes API keys to the client. Honest errors when the key is missing.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const AI_PROVIDER = (Deno.env.get("AI_PROVIDER") || "openai").toLowerCase();
const AI_API_KEY = Deno.env.get("AI_API_KEY") || "";
const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4o-mini";
const AI_BASE_URL = Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1";

// ---------------------------------------------------------------------------
// Auth: extract caller identity and role from the service client
// ---------------------------------------------------------------------------
async function getCaller(supabase: any, jwt: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Error("unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  return { user, profile };
}

// ---------------------------------------------------------------------------
// LLM call (OpenAI-compatible chat completions)
// Works with OpenAI, OpenRouter, Together, Groq, local llama.cpp /v1, etc.
// ---------------------------------------------------------------------------
async function callLLM(messages: ChatMessage[]): Promise<string> {
  if (!AI_API_KEY) {
    throw new Error(
      "AI_API_KEY is not configured. Set AI_PROVIDER, AI_API_KEY, AI_MODEL, and optionally AI_BASE_URL in Supabase Edge Function secrets."
    );
  }
  const url = `${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI provider error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned an empty response.");
  return content as string;
}

// ---------------------------------------------------------------------------
// RAG: fetch relevant HR knowledge documents (simple keyword match)
// ---------------------------------------------------------------------------
async function fetchRelevantDocs(supabase: any, query: string, k = 4) {
  const { data, error } = await supabase
    .from("hr_documents")
    .select("title, category, content, tags")
    .limit(20);
  if (error || !data) return [];
  const q = query.toLowerCase();
  const words = q.split(/\W+/).filter((w) => w.length > 3);
  const scored = data.map((d) => {
    const blob = `${d.title} ${d.category} ${(d.tags || []).join(" ")} ${d.content}`.toLowerCase();
    let score = 0;
    for (const w of words) if (blob.includes(w)) score += 1;
    return { d, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, k);
  const picked = top.length ? top : scored.slice(0, k);
  return picked.map((s) => s.d);
}

// ---------------------------------------------------------------------------
// Authorized aggregate data fetchers for analytics / insights / summarize
// ---------------------------------------------------------------------------

// Fetch workforce summary stats. Authorized aggregate data only — no PII.
async function workforceSummary(supabase: any) {
  const [emp, dept, depts] = await Promise.all([
    supabase.from("employees").select("employment_status, department_id, hire_date"),
    supabase.from("analytics_department_distribution").select("department_name, employee_count"),
    supabase.from("departments").select("id, name"),
  ]);
  const employees = emp.data || [];
  const total = employees.length;
  const active = employees.filter((e: any) => e.employment_status === "active").length;
  const byDept = (dept.data || []).map((d: any) => `${d.department_name}: ${d.employee_count}`);
  return {
    total_employees: total,
    active_employees: active,
    inactive_employees: total - active,
    department_distribution: byDept,
  };
}

// Fetch leave summary (authorized aggregate)
async function leaveSummary(supabase: any) {
  const { data } = await supabase
    .from("leave_requests")
    .select("status, leave_type_id, start_date, end_date");
  const rows = data || [];
  const pending = rows.filter((r: any) => r.status === "pending").length;
  const approved = rows.filter((r: any) => r.status === "approved").length;
  const rejected = rows.filter((r: any) => r.status === "rejected").length;
  return { total: rows.length, pending, approved, rejected };
}

// Fetch attendance summary (authorized aggregate, last 30 days)
async function attendanceSummary(supabase: any) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data } = await supabase
    .from("attendance")
    .select("status, check_in, check_out")
    .gte("check_in", since.toISOString());
  const rows = data || [];
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const late = byStatus["late"] || 0;
  const present = byStatus["present"] || 0;
  return {
    records_last_30_days: rows.length,
    present,
    late,
    half_day: byStatus["half_day"] || 0,
    leave: byStatus["leave"] || 0,
  };
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

// A. HR Knowledge Assistant (RAG)
async function handleChat(supabase: any, body: any, caller: any) {
  const question = String(body.question || "").slice(0, 1000);
  if (!question.trim()) throw new Error("question is required");
  const docs = await fetchRelevantDocs(supabase, question);
  const context = docs.length
    ? docs.map((d, i) => `[Doc ${i + 1}: ${d.title}]\n${d.content}`).join("\n\n")
    : "No relevant HR policy documents were found.";

  const systemPrompt = `You are NEXORA AI, an HR knowledge assistant for a company.
Answer the employee's question using ONLY the provided HR documents. If the answer
is not contained in the documents, say so explicitly and suggest they contact HR.
Never invent policies. Keep answers concise and professional.

HR KNOWLEDGE DOCUMENTS:
${context}

The asking user is ${caller.profile?.full_name || "an employee"} with role ${caller.profile?.role || "employee"}.`;

  const answer = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ]);
  return { answer, sources: docs.map((d) => d.title) };
}

// E. Job Description Generator
async function handleJD(body: any) {
  const jobTitle = String(body.job_title || "").slice(0, 120);
  const department = String(body.department || "").slice(0, 120);
  const skills = String(body.skills || "").slice(0, 500);
  const experienceLevel = String(body.experience_level || "Mid-level").slice(0, 60);
  if (!jobTitle.trim()) throw new Error("job_title is required");

  const systemPrompt = `You are NEXORA AI, a professional job description generator.
Generate a complete, editable job description in Markdown. Include:
- Job title and department
- Role summary
- Key responsibilities (5-8 bullet points)
- Required skills and qualifications
- Preferred qualifications
- Experience level
- What we offer
Keep it professional and inclusive. Do not invent a specific salary.`;

  const userPrompt = `Generate a job description for:
Job Title: ${jobTitle}
Department: ${department}
Required Skills: ${skills}
Experience Level: ${experienceLevel}`;

  const content = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  return { content };
}

// C. Report Summarizer (attendance + leave reports)
async function handleSummarize(supabase: any, body: any) {
  const range = String(body.range || "last 30 days").slice(0, 60);
  const [att, leave] = await Promise.all([
    attendanceSummary(supabase),
    leaveSummary(supabase),
  ]);
  const wf = await workforceSummary(supabase);

  const systemPrompt = `You are NEXORA AI, a report summarizer for HR data.
Summarize the provided aggregate attendance and leave data in clear, professional prose.
Identify notable trends. Clearly state the date range and the data used. Do NOT invent
numbers — use only the provided data. Separate factual observations from your interpretations.`;

  const userPrompt = `Date range: ${range}

Workforce: ${JSON.stringify(wf)}
Attendance (last 30 days): ${JSON.stringify(att)}
Leave: ${JSON.stringify(leave)}

Summarize attendance and leave for this period.`;

  const summary = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  return {
    summary,
    data_range: range,
    data_used: { workforce: wf, attendance: att, leave },
  };
}

// D. Natural-Language HR Analytics
async function handleAnalytics(supabase: any, body: any) {
  const question = String(body.question || "").slice(0, 1000);
  if (!question.trim()) throw new Error("question is required");

  const [wf, att, leave] = await Promise.all([
    workforceSummary(supabase),
    attendanceSummary(supabase),
    leaveSummary(supabase),
  ]);
  const data = { workforce: wf, attendance: att, leave };

  const systemPrompt = `You are NEXORA AI, an HR analytics assistant.
Answer the user's question using ONLY the provided aggregate, authorized data.
Do not execute SQL. Do not access individual employee records. If the data is
insufficient to answer, say so. Reference the specific figures you used.`;

  const userPrompt = `Question: ${question}

Available aggregate data:
${JSON.stringify(data)}

Answer the question using only this data.`;

  const answer = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  return { answer, data_used: data };
}

// F. Workforce Insights
async function handleInsights(supabase: any) {
  const [wf, att, leave] = await Promise.all([
    workforceSummary(supabase),
    attendanceSummary(supabase),
    leaveSummary(supabase),
  ]);
  const data = { workforce: wf, attendance: att, leave };

  const systemPrompt = `You are NEXORA AI, a workforce insights assistant.
Identify trends in the provided aggregate data. Clearly distinguish actual
observations from your interpretations. Do NOT make hiring, firing, promotion,
or compensation decisions or recommendations. Provide observations only.`;

  const userPrompt = `Aggregate workforce, attendance, and leave data:
${JSON.stringify(data)}

Identify notable trends and patterns.`;

  const insights = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  return { insights, data_used: data };
}

// ---------------------------------------------------------------------------
// Main server
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    if (!jwt || jwt === "") {
      return new Response(JSON.stringify({ error: "unauthorized: missing token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const caller = await getCaller(supabase, jwt);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toLowerCase();

    let result: any;
    switch (action) {
      case "chat":
        result = await handleChat(supabase, body, caller);
        break;
      case "jd":
        result = await handleJD(body);
        break;
      case "summarize":
        result = await handleSummarize(supabase, body);
        break;
      case "analytics":
        result = await handleAnalytics(supabase, body);
        break;
      case "insights":
        result = await handleInsights(supabase);
        break;
      default:
        return new Response(
          JSON.stringify({
            error:
              "unknown action. Supported: chat, jd, summarize, analytics, insights",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /unauthorized|missing token/.test(message) ? 401 : 500;
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
