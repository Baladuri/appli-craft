# Spec: Multi-Model Platform (DeepSeek)

## Goal

Add DeepSeek as an alternative LLM provider, selectable via env var. Claude remains the default. No other behavior changes.

---

## Files to change

### 1. `src/config/index.ts`

Add two fields to `Config`:

```typescript
llmProvider: 'claude' | 'deepseek';   // LLM_PROVIDER env var, default 'claude'
deepseekApiKey: string;                // DEEPSEEK_API_KEY env var, default ''
```

Update `validateConfig()`:

- If `mockMode` is false and `llmProvider === 'claude'`: require `anthropicApiKey` (existing check, unchanged).
- If `mockMode` is false and `llmProvider === 'deepseek'`: require `deepseekApiKey`. Throw: `'DEEPSEEK_API_KEY is required when LLM_PROVIDER=deepseek'`.
- If `llmProvider` is any other value: throw `'Unknown LLM_PROVIDER: <value>. Must be claude or deepseek'`.

Acceptance criteria:
- `LLM_PROVIDER` not set → `llmProvider` is `'claude'`.
- `LLM_PROVIDER=deepseek` with no `DEEPSEEK_API_KEY` → `validateConfig()` throws on startup.
- `LLM_PROVIDER=deepseek` with `DEEPSEEK_API_KEY` set → no throw.
- `LLM_PROVIDER=claude` with no `ANTHROPIC_API_KEY` → same throw as today.
- Invalid value → throws with the value named in the message.

---

### 2. `src/clients/DeepSeekClient.ts` (new file)

Implements `LLMClient`. Structure mirrors `ClaudeClient`:

- Reads `config.deepseekApiKey` and `config.mockMode` at construction time.
- Uses the DeepSeek OpenAI-compatible API (`https://api.deepseek.com/v1`) via the `openai` npm package (already a common transitive dep — confirm before adding).
- Target model: `deepseek-chat` (configurable via `config` if needed later, not a constructor param).
- `generateText`: single user message, `temperature: 0`, `max_tokens: 4096`.
- `generateJSON`: same pattern as `ClaudeClient` — append JSON instruction, call `generateText`, extract `{...}`, `JSON.parse`.
- Mock mode: return same fixture strings as `ClaudeClient` mock mode so tests are provider-agnostic.

Acceptance criteria:
- Class implements `LLMClient` without casting (`implements LLMClient` explicit on the class).
- `npx tsc --noEmit` passes with no errors.
- Mock mode returns the same fixture structure as `ClaudeClient` mock (same keys, same shape).
- File lives at `src/clients/DeepSeekClient.ts`, not `src/core/`.

---

### 3. `src/index.ts` — client factory

Replace the two direct `new ClaudeClient()` instantiations (`runApplication` and `runMaterials`) with a shared factory function:

```typescript
function createLLMClient(): LLMClient {
  if (config.llmProvider === 'deepseek') return new DeepSeekClient();
  return new ClaudeClient();
}
```

Call `createLLMClient()` where `new ClaudeClient()` currently appears.

Acceptance criteria:
- No call site calls `new ClaudeClient()` or `new DeepSeekClient()` directly.
- Both `runApplication` and `runMaterials` use `createLLMClient()`.
- Switching `LLM_PROVIDER` requires only an env var change — no code change.

---

### 4. `.env.example` (new file)

```
# LLM provider: claude (default) or deepseek
LLM_PROVIDER=claude

ANTHROPIC_API_KEY=your_anthropic_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here

MOCK_MODE=false
GITHUB_TOKEN=
GITHUB_USERNAME=
```

Acceptance criteria:
- File exists at repo root.
- All env vars currently read by `src/config/index.ts` are present.
- Comments explain the `LLM_PROVIDER` options.

---

## What does NOT change

- `LLMClient` interface — no new methods.
- `BaseAgent` — no changes.
- All agents — no changes.
- Frontend — no changes.
- `src/server.ts` — no changes.
- Mock mode behavior — identical across providers.

---

## Error behavior summary

| Condition | Result |
|---|---|
| `LLM_PROVIDER` not set | defaults to `claude` |
| `LLM_PROVIDER=claude`, no `ANTHROPIC_API_KEY` | throws at `validateConfig()` |
| `LLM_PROVIDER=deepseek`, no `DEEPSEEK_API_KEY` | throws at `validateConfig()` |
| `LLM_PROVIDER=deepseek`, key present | works |
| `LLM_PROVIDER=anything-else` | throws at `validateConfig()` |
| `MOCK_MODE=true` | skips all key checks, no network calls |

---

## Open question — resolved

**Text tasks**: No new npm packages needed. Use the existing Anthropic SDK with a custom `baseURL`:
- `baseURL`: `https://api.deepseek.com/anthropic`
- `model`: `deepseek-v4-flash`
- `apiKey`: `DEEPSEEK_API_KEY`

**Screenshot/vision tasks**: DeepSeek VL2 via OpenAI-compatible endpoint — this requires the `openai` npm package:
- `baseURL`: `https://api.deepseek.com`
- `model`: `deepseek-vl2`
- `apiKey`: same `DEEPSEEK_API_KEY`

If VL2 vision fails in testing, the screenshot feature is removed and revisited when DeepSeek V4 adds native vision support. All other text tasks are unaffected.
