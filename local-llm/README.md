# Local LLM

The project uses `Llama-3.2-1B-Instruct-Q4_K_M.gguf` through `llama.cpp`.

- Model size: 807,694,464 bytes (770.3 MiB)
- SHA-256: `6F85A640A97CF2BF5B8E764087B1E83DA0FDB51D7C9FAB7D0FECE9385611DF83`
- Source: `bartowski/Llama-3.2-1B-Instruct-GGUF` on Hugging Face
- Local API: `http://127.0.0.1:8081/v1/chat/completions`

Start the model server:

```powershell
.\local-llm\start.ps1
```

The numerical credit decision remains rule-based. The LLM only rewrites validated
facts into a short client-facing explanation. Its response is rejected when it
contains digits or Latin characters; the backend then uses a deterministic fallback.
