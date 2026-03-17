# SkyDex4 UI rebuild · files pane separation

This rebuild separates the repo browser from the workspace state pane.

## What changed
- Files are now in their own detachable/minimizable pane.
- Workspace is now just project name, save state, diff, and release context.
- Controls remain separate from View and Actions.
- OpenAI still runs server-side through `OPENAI_API_KEY`, not through the gateway.

## Deploy
Run from the project root with Netlify CLI:

```bash
npx netlify-cli dev
npx netlify-cli deploy --prod
```

## OpenAI note
A `401` from `/api/ai-agent` means OpenAI rejected the server key currently in the environment. That is a secret/config issue, not a gateway routing issue.
