# LLMClient Pattern Reference

## Interface contract

`src/clients/LLMClient.ts`

```typescript
export interface LLMClient {
  generateText(prompt: string): Promise<string>;
  generateJSON<T>(prompt: string): Promise<T>;
}
```

Both methods take a single string prompt. There is no system-prompt parameter, no message history, no streaming. The interface is intentionally minimal.

## What generateJSON does

`ClaudeClient.generateJSON` is not a separate API call type — it appends a JSON-enforcement instruction to the prompt, calls `generateText`, then extracts the substring between the first `{` and last `}` and runs `JSON.parse` on it. If parsing fails it throws `"Invalid JSON response from Claude"`.

Any new client implementing `generateJSON` must replicate this contract: strip markdown fences, extract the JSON object, and parse it. Do not return raw text from `generateJSON`.

## Concrete implementation: ClaudeClient

`src/core/claude-client.ts`

- Wraps `@anthropic-ai/sdk` `Anthropic` class.
- Reads config at construction time from the `config` singleton (`src/config/index.ts`). No constructor parameters.
- Uses `config.anthropicApiKey`, `config.model`, `config.mockMode`.
- API call params: `temperature: 0`, `max_tokens: 4096`, single user message.
- Mock mode: if `config.mockMode === true`, `generateText` returns `"MOCK_RESPONSE"` and `generateJSON` returns hardcoded fixtures keyed on prompt substrings. Mock mode bypasses all network calls.

## How clients are injected into agents

`src/agents/base-agent.ts`

```typescript
export abstract class BaseAgent {
  protected llm: LLMClient;
  constructor(agentName: string, llm: LLMClient) {
    this.agentName = agentName;
    this.llm = llm;
  }
}
```

All agents extend `BaseAgent`. The `LLMClient` instance is passed in the constructor. Agents never instantiate a client themselves.

In `src/index.ts` the orchestrator is the only place where a concrete client is created:

```typescript
const llmClient: LLMClient = new ClaudeClient();
const researcher = new ResearcherAgent(llmClient);
const analyst = new AnalystAgent(llmClient);
```

Same pattern in `runMaterials`. One client instance per pipeline run, shared across all agents in that run.

## Config structure relevant to LLM

`src/config/index.ts`

```typescript
export interface Config {
  anthropicApiKey: string;  // ANTHROPIC_API_KEY env var
  model: string;            // hardcoded: 'claude-haiku-4-5'
  mockMode: boolean;        // MOCK_MODE=true env var
  // ... non-LLM fields omitted
}
```

`validateConfig()` throws if `mockMode` is false and `anthropicApiKey` is empty. This is the only guard; there is no per-provider validation yet.

## Rules for adding a new client

1. Implement `LLMClient` from `src/clients/LLMClient.ts`. Do not touch the interface.
2. Place the file in `src/clients/` (e.g. `src/clients/DeepSeekClient.ts`), not `src/core/`.
3. Read API key and model from `config` — do not accept them as constructor parameters.
4. `generateJSON` must extract and parse JSON, not return raw text.
5. Replicate mock mode behavior: check `config.mockMode` and return fixture data without network calls.
6. The orchestrator (`src/index.ts`) is the only place to instantiate the client — add a factory there, not in each agent.
