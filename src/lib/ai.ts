import { supabase, AI_FUNCTION_URL } from './supabase';
import type { Role } from './types';

export type AIResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export async function callAI<T = unknown>(
  payload: Record<string, unknown>
): Promise<AIResult<T>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return { ok: false, error: 'You must be signed in to use AI features.' };

    const res = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      const msg =
        (json && (json.error || json.message)) ||
        `Request failed (${res.status})`;
      return { ok: false, error: msg };
    }
    if (json.ok === false) {
      return { ok: false, error: json.error || 'AI request failed.' };
    }
    const { ok: _ok, ...rest } = json;
    return { ok: true, ...(rest as T) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, error: message };
  }
}

export const AI_ACTIONS = {
  chat: (question: string) => callAI<{ answer: string; sources: string[] }>({ action: 'chat', question }),
  jd: (p: { job_title: string; department: string; skills: string; experience_level: string }) =>
    callAI<{ content: string }>({ action: 'jd', ...p }),
  summarize: (range: string) =>
    callAI<{ summary: string; data_range: string; data_used: unknown }>({ action: 'summarize', range }),
  analytics: (question: string) =>
    callAI<{ answer: string; data_used: unknown }>({ action: 'analytics', question }),
  insights: () => callAI<{ insights: string; data_used: unknown }>({ action: 'insights' }),
} as const;

export type AssistantRole = Role;
