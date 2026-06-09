# Vercel Image Model Configuration

The image generation backend supports two layers of configuration:

1. Runtime provider rows managed in `/admin` → `生图模型配置`.
2. Vercel `OPENAI_*` environment variables as the final fallback.

Do not put provider keys in source code.

## Required fallback variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `OPENAI_API_KEY` | Server-side API key for the fallback OpenAI-compatible image provider | `[set in Vercel only]` |
| `OPENAI_BASE_URL` | Fallback OpenAI-compatible API base URL | `https://safeapi.vip/v1` or `https://ai-pixel.online/v1` |
| `OPENAI_IMAGE_MODEL` | Fallback image generation/edit model ID | `gpt-image-2` |

## Runtime admin fallback

Admins can configure provider rows in `/admin` → `生图模型配置`:

- `name`: human-readable provider name.
- `baseURL`: OpenAI-compatible API base URL, for example `https://safeapi.vip/v1`.
- `model`: image model ID.
- `apiKey`: provider key. It is stored encrypted in Vercel KV and masked in the UI.
- `priority`: lower numbers run first.
- `enabled`: disabled rows are skipped.

Generation tries enabled admin rows by priority. If the first provider fails, the backend automatically falls back to the next enabled row. If all admin rows fail or none are configured, it falls back to the Vercel `OPENAI_*` environment variables.

## Vercel setup

1. Open the Vercel project.
2. Go to **Settings → Environment Variables**.
3. Add the fallback variables above for **Production** and, if needed, **Preview**.
4. Redeploy the project after changing variables.
5. Optional but recommended: set `IMAGE_PROVIDER_SECRET` to a stable random string so admin-entered provider keys can be encrypted consistently across deployments.

## Notes

- `OPENAI_IMAGE_MODEL` defaults to `gpt-image-2` when unset.
- `OPENAI_BASE_URL` defaults to `https://ai-pixel.online/v1` when unset.
- The provider must support both image generation and image editing endpoints because the app uses text-to-image and image edit flows.
- Never use `NEXT_PUBLIC_` for provider keys; that would expose secrets to the browser.
