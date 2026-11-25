# Quill fix pack — real LLM chat, no demo writer

## Files
- `app/api/chats/[id]/run/route.ts` — greetings like "Hi" use chat mode + real `llmChat`
- `lib/pipeline.ts` — requires `USER_LLM_API_KEY`; chapters only from real `llmWriteChapter` (no synthetic demo)

## Apply
From your local clone of Godszeal/quill:

```bash
# unzip over repo root (keeps paths)
unzip -o quill-fix-real-llm.zip

git add app/api/chats/\[id\]/run/route.ts lib/pipeline.ts
git commit -m "fix: Hi returns real LLM chat; require real model for chapters (no demo)"
git push origin main
```

## Vercel env (already set if you followed earlier steps)
- USER_LLM_API_KEY
- USER_LLM_BASE_URL=https://integrate.api.nvidia.com/v1
- USER_LLM_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b

After deploy, send **Hi** — you should get a normal assistant reply, not the manuscript pipeline.
