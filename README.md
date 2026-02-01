# URL Shortener

A simple Cloudflare Worker-based URL shortener with Supabase backend. Zero CSS, straightforward interface.

## Features

- 🔗 Create short URLs via web UI or API
- 🎲 Random or custom short codes
- 🔐 Basic auth for UI (`/short`)
- 🔑 Separate API key authentication for API endpoint (`/api-short`)
- 🗄️ Supabase PostgreSQL database
- ⚡ Instant redirects
- 📱 Zero CSS design

## Routes

| Route | Description | Auth |
|-------|-------------|------|
| `/` | Welcome page | None |
| `/short` | Create short URLs (UI) | Basic Auth |
| `/api-short` | API endpoint for CRUD operations | API Key |
| `/:code` | Redirect to original URL | None |

## Setup

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Get your credentials:
   - **Project URL**: Settings → API → Project URL
   - **API Key**: Settings → API → Project API keys → `anon` `public`

### 2. Cloudflare Worker Setup

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Add secrets (see `CLOUDFLARE_SECRETS.md` for details):
   ```bash
   wrangler secret put BASIC_AUTH_USER
   wrangler secret put BASIC_AUTH_PASS
   wrangler secret put API_SECRET
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_KEY
   ```

4. Deploy the worker:
   ```bash
   wrangler deploy
   ```

### 3. Required Secrets

See [CLOUDFLARE_SECRETS.md](CLOUDFLARE_SECRETS.md) for the complete list and instructions.

## Usage

### Web UI (`/short`)

1. Navigate to `https://your-worker.workers.dev/short`
2. Enter basic auth credentials (username/password you set)
3. Fill in:
   - **Original URL**: The long URL to shorten
   - **Custom Short Code** (optional): Leave empty for random code
4. Click **Shorten URL**

### API Endpoint (`/api-short`)

All API requests require the `X-API-Key` header with your `API_SECRET`.

#### Create Short URL

```bash
curl -X POST https://your-worker.workers.dev/api-short \
  -H "X-API-Key: your-api-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/very/long/url",
    "custom_code": "mylink"
  }'
```

**Response:**
```json
{
  "success": true,
  "short_code": "mylink",
  "short_url": "https://your-worker.workers.dev/mylink",
  "original_url": "https://example.com/very/long/url"
}
```

**Note:** `custom_code` is optional. If omitted, a random code will be generated.

#### Get Short URL Info

```bash
curl https://your-worker.workers.dev/api-short?code=mylink \
  -H "X-API-Key: your-api-secret"
```

**Response:**
```json
{
  "id": "uuid-here",
  "short_code": "mylink",
  "original_url": "https://example.com/very/long/url",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Delete Short URL

```bash
curl -X DELETE https://your-worker.workers.dev/api-short?code=mylink \
  -H "X-API-Key: your-api-secret"
```

**Response:**
```json
{
  "success": true,
  "message": "Short URL deleted"
}
```

## Database Schema

The Supabase table structure:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `short_code` | TEXT | Unique short code |
| `original_url` | TEXT | Target URL |
| `created_at` | TIMESTAMP | Creation time |

## Security

- `/short` UI uses HTTP Basic Authentication
- `/api-short` uses API key authentication (separate from basic auth)
- All secrets are stored as encrypted environment variables in Cloudflare
- Supabase Row Level Security (RLS) enabled

## Local Development

For local testing with `wrangler dev`:

1. Copy the example environment file:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. Edit `.dev.vars` and add your actual values:
   ```bash
   BASIC_AUTH_USER=admin
   BASIC_AUTH_PASS=your-password
   API_SECRET=your-api-secret
   SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   SUPABASE_KEY=eyJhbGci...
   ```

3. Start the development server:
   ```bash
   wrangler dev
   ```

**Note:** `.dev.vars` is gitignored - never commit it to version control.

## Development

To test locally:

```bash
wrangler dev
```

Make sure to set up secrets locally first using `wrangler secret put` as shown above.

## License

MIT
