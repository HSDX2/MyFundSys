# Supabase Edge Functions

**Purpose**: Deno-based serverless functions for proxying EastMoney fund data API calls.

## Structure

| Function | File | Purpose | Endpoint |
|----------|------|---------|----------|
| `fund-search` | `fund-search/index.ts` | Search funds by keyword/code | `POST /functions/v1/fund-search` |
| `fund-nav` | `fund-nav/index.ts` | Get latest NAV for fund codes | `POST /functions/v1/fund-nav` |
| `fund-history` | `fund-history/index.ts` | Get historical NAV data | `POST /functions/v1/fund-history` |

## Architecture

```
Frontend (React)
    │
    └─ POST /functions/v1/{function-name}
         Headers: { Authorization: Bearer <anon-key> }
         Body: { ...params }
             │
             ▼
    ┌─────────────────────────────┐
    │  Supabase Edge Function     │  (Deno runtime)
    │  - CORS headers             │
    │  - Auth validation          │
    │  - Param extraction         │
    │  - EastMoney API call       │
    └─────────────────────────────┘
             │
             ▼
    EastMoney API (fund.eastmoney.com)
    (With mobile User-Agent spoofing)
```

## Key Implementation Details

### 1. CORS Handling

All functions include CORS headers for frontend access:

```typescript
// Standard CORS headers in every function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

### 2. Parameter Extraction

Functions read parameters from `req.json()` body (NOT URL query):

```typescript
// CORRECT: Read from body
const { keyword, page = 1, pageSize = 20 } = await req.json();

// INCORRECT: Never use URL params
// const url = new URL(req.url);
// const keyword = url.searchParams.get('keyword');
```

### 3. EastMoney API Calls

Mobile User-Agent required to bypass restrictions:

```typescript
// Required headers for EastMoney API
const headers = {
  'User-Agent': 'EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)',
  'Referer': 'https://fund.eastmoney.com/',
  'Accept': 'application/json',
};

// Example: Search funds
const response = await fetch(
  `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=${page}&pageSize=${pageSize}&appType=ttfund&product=EFund&plat=Android&deviceid=${deviceId}&Version=6.3.6`,
  { headers }
);
```

### 4. Response Format

Standard response envelope for all functions:

```typescript
// Success response
return new Response(
  JSON.stringify({
    success: true,
    data: { funds, total },
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);

// Error response
return new Response(
  JSON.stringify({
    success: false,
    error: error.message,
  }),
  { 
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  }
);
```

## Function-Specific Details

### fund-search

**Purpose**: Search funds by keyword or exact code match

**Parameters**:
```typescript
{
  keyword: string;      // Search term (fund name or code)
  page?: number;        // Page index (default: 1)
  pageSize?: number;    // Items per page (default: 20)
}
```

**Features**:
- Backend-loaded fund mapping (B-class funds mapped to A-class)
- Exact code match returns single result
- Keyword search returns multiple results
- Returns: fund code, name, NAV, daily change

### fund-nav

**Purpose**: Get latest NAV for multiple funds

**Parameters**:
```typescript
{
  codes: string[];      // Array of fund codes
}
```

**Features**:
- Batch query for up to 100 codes
- Returns: NAV, daily change percentage, update date
- Used for portfolio valuation updates

**Note**: EastMoney returns 20 items per page regardless of requested pageSize

### fund-history

**Purpose**: Get historical NAV data for charts

**Parameters**:
```typescript
{
  code: string;           // Fund code
  startDate: string;      // Start date (YYYY-MM-DD)
  endDate: string;        // End date (YYYY-MM-DD)
}
```

**Features**:
- Date range query
- Returns: date, NAV, daily change
- Used for fund detail charts

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

## Deployment

Deploy individual functions:

```bash
# Deploy single function
supabase functions deploy fund-search --project-ref <project-ref>

# Deploy all functions
supabase functions deploy --project-ref <project-ref>
```

## Local Development

Run functions locally:

```bash
# Start Supabase locally
supabase start

# Serve functions with hot reload
supabase functions serve fund-search --env-file ./supabase/.env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/fund-search \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "沪深300", "page": 1, "pageSize": 20}'
```

## Notes

- **Deno runtime**: All functions run in Deno (not Node.js)
- **Cold start**: First request after deployment may be slow (~1-2s)
- **Timeout**: Functions timeout after 10 seconds
- **Memory**: Default 128MB memory limit
- **No npm**: Use Deno standard library or esm.sh for dependencies
- **Logs**: View in Supabase Dashboard → Functions → Logs
