# Vercel Image Model Configuration

The image generation backend is configured with Vercel Environment Variables. Do not put provider keys in source code.

## Required variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `OPENAI_API_KEY` | Server-side API key for the OpenAI-compatible image provider | `[set in Vercel only]` |
| `OPENAI_BASE_URL` | OpenAI-compatible API base URL | `https://safeapi.vip/v1` or `https://ai-pixel.online/v1` |
| `OPENAI_IMAGE_MODEL` | Image generation/edit model ID | `gpt-image-2` |

## Vercel setup

1. Open the Vercel project.
2. Go to **Settings → Environment Variables**.
3. Add the variables above for **Production** and, if needed, **Preview**.
4. Redeploy the project after changing variables.

## Notes

- `OPENAI_IMAGE_MODEL` defaults to `gpt-image-2` when unset.
- `OPENAI_BASE_URL` defaults to `https://ai-pixel.online/v1` when unset.
- The provider must support both image generation and image editing endpoints because the app uses text-to-image and image edit flows.
- Never use `NEXT_PUBLIC_` for provider keys; that would expose secrets to the browser.
