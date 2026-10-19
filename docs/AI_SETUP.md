# AI Provider Setup

NEXORA AI's AI features are powered by a **real LLM** called through a secure
Supabase Edge Function. No API keys ever reach the browser.

The edge function (`supabase/functions/ai-hr-assistant`) is **provider-agnostic**
and works with any OpenAI-compatible `/chat/completions` endpoint, including:

- OpenAI (`gpt-4o-mini`, `gpt-4o`, etc.)
- OpenRouter (aggregator with free + paid models)
- Together AI
- Groq (very fast, free tier)
- A local `llama.cpp` / Ollama server exposing an OpenAI-compatible API

## Step 1 — Get an API key

Pick one provider and create an account:

| Provider | Default model | Notes |
|----------|---------------|-------|
| OpenAI | `gpt-4o-mini` | Paid, widely supported. https://platform.openai.com |
| OpenRouter | `openai/gpt-4o-mini` | Free + paid models. https://openrouter.ai |
| Groq | `llama-3.1-8b-instant` | Free tier, very fast. https://console.groq.com |
| Together | `meta-llama/Llama-3-8b-chat-hf` | https://api.together.xyz |

## Step 2 — Configure the secrets

The secrets are read by the edge function from the Supabase project's Edge
Function secrets store — **not** from the local `.env` file. Set them in the
Supabase Dashboard → Project Settings → Edge Functions → Secrets, or via the
Supabase CLI/MCP tools.

| Secret | Example value |
|--------|---------------|
| `AI_PROVIDER` | `openai` |
| `AI_API_KEY` | `sk-...` |
| `AI_MODEL` | `gpt-4o-mini` |
| `AI_BASE_URL` | `https://api.openai.com/v1` |

### Example: Groq (free, fast)

```
AI_PROVIDER=groq
AI_API_KEY=gsk_...
AI_MODEL=llama-3.1-8b-instant
AI_BASE_URL=https://api.groq.com/openai/v1
```

### Example: OpenRouter

```
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-...
AI_MODEL=openai/gpt-4o-mini
AI_BASE_URL=https://openrouter.ai/api/v1
```

## Step 3 — Verify

1. Sign in to NEXORA AI.
2. Open **AI HR Assistant** → ask "What is the remote work policy?".
3. If the key is missing or invalid, you will see an honest error message naming
   the missing secret — the app never fakes AI responses.

## How it works (security)

```
Browser ──Bearer JWT──▶ Edge Function (verify_jwt=true)
                            │
                            ├─ auth.getUser(jwt) → identify caller + role
                            ├─ Fetch authorized aggregate data from DB
                            ├─ Build a constrained system prompt
                            └─ POST /chat/completions ──API_KEY──▶ LLM provider
                                  ◀── answer ──
```

- The LLM **never** executes SQL. Only pre-defined, parameterized query
  functions fetch aggregate data, which is injected into the prompt as context.
- The LLM **never** sees individual employee records for analytics — only
  aggregate counts and summaries.
- API keys live only in Supabase Edge Function secrets and are never logged.
- Missing keys produce an explicit error; the app does not pretend AI is working.
