# Supabase Edge Functions

**Purpose**: Deno-based serverless functions for proxying EastMoney fund data API calls.

## Structure

| Function | File | Purpose | Endpoint |
|----------|------|---------|----------|
| `fund-search` | `fund-search/index.ts` | Search funds by keyword/code | `POST /functions/v1/fund-search` |
| `fund-nav` | `fund-nav/index.ts` | Get latest NAV for fund codes | `POST /functions/v1/fund-nav` |
| `fund-history` | `fund-history/index.ts` | Get historical NAV data | `POST /functions/v1/fund-history` |

## Conventions

1. **File Naming**: `index.ts` in function-named directory (`fund-search/index.ts`)
2. **HTTP Method**: Always POST (even for reads)
3. **CORS**: Always include CORS headers
4. **Auth**: Validate Supabase anon key from Authorization header
5. **Error Handling**: Return JSON with `success: false` and error message
6. **Logging**: Use `console.error()` for errors (visible in Supabase logs)
7. **Mobile UA**: Always spoof iPhone User-Agent for EastMoney
8. **Device ID**: Generate consistent device ID per request

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Add new function | Create `new-function/index.ts` | Copy existing function structure |
| Modify search logic | `fund-search/index.ts` | Backend-loaded fund mapping |
| Add NAV fields | `fund-nav/index.ts` | EastMoney response parsing |
| Extend history range | `fund-history/index.ts` | Date parameter handling |
| Fix CORS issues | Any function | Check corsHeaders in response |

## Notes

- **Deno runtime**: All functions run in Deno (not Node.js)
- **Cold start**: First request after deployment may be slow (~1-2s)
- **Timeout**: Functions timeout after 10 seconds
- **Memory**: Default 128MB memory limit
- **No npm**: Use Deno standard library or esm.sh for dependencies
- **Logs**: View in Supabase Dashboard → Functions → Logs
- See `CLAUDE.md` for full architecture: API call chain, parameter extraction, CORS, EastMoney headers
