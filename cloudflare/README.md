# Alexa to Todoist Sync - Cloudflare Edition

Serverless, Cloudflare-native architecture for syncing Amazon Alexa shopping lists to Todoist.

## Architecture

- **Frontend**: Static HTML/JS hosted on Cloudflare Pages
- **Backend**: Cloudflare Workers with Hono framework
- **Browser Automation**: @cloudflare/puppeteer (Browser Rendering)
- **Storage**: Cloudflare KV (sessions & user data)
- **Queue**: Cloudflare Queues (background sync jobs)
- **Cron**: Scheduled Workers (every 15 minutes)

## Cost Estimate ⚠️

**Important**: Cloudflare Browser Rendering charges **per second**, which makes frequent polling expensive!

### Scenario: 1,000 users, poll Amazon every 15 minutes

- **Amazon → Todoist**: 96 syncs/day × 10s = 8,000 hours/month
- **Todoist → Amazon**: 1 sync/day × 10s = 84 hours/month
- **Browser Rendering**: ~$719/month 💸
- **Workers**: $5/month
- **Queues**: ~$0.40/month
- **KV**: ~$0.10/month
- **Total**: ~**$725/month** for 1,000 users

### Less Frequent Option: Poll every 60 minutes

- **Browser Rendering**: ~$180/month
- **Total**: ~**$185/month** for 1,000 users

**See COST_ANALYSIS.md for full breakdown and alternatives.**

For frequent polling, the **Docker SaaS version** is more cost-effective (~$40/month).

## Setup

### 1. Install Dependencies

```bash
cd cloudflare
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create Resources

```bash
# Create KV namespaces
npx wrangler kv:namespace create SESSIONS
npx wrangler kv:namespace create USERS

# Create Queue
npx wrangler queues create alexa-todoist-sync-queue
```

### 4. Update wrangler.toml

Replace the placeholder IDs in `wrangler.toml` with the IDs from step 3.

### 5. Set Secrets

```bash
# Generate a strong encryption key
openssl rand -base64 32 | npx wrangler secret put ENCRYPTION_KEY

# Generate JWT secret
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET
```

### 6. Deploy Worker

```bash
npx wrangler deploy
```

### 7. Deploy Frontend

```bash
# Update API_URL in frontend/index.html with your Worker URL
# Then deploy to Cloudflare Pages:
npx wrangler pages deploy frontend
```

## Development

```bash
# Run locally
npm run dev

# View logs
npm run tail
```

## How It Works

### User Flow

1. **Sign Up**: User creates account
2. **Connect Todoist**: User provides API token and project ID
3. **Connect Amazon**: User provides Amazon credentials once
   - Worker launches Puppeteer browser
   - Logs in to Amazon
   - Extracts session cookies
   - Encrypts and stores cookies (password discarded)
4. **Automatic Sync**: Cron runs every 15 minutes
   - Checks which users need syncing
   - Enqueues sync jobs to Queue
   - Queue consumer processes jobs in parallel

### Sync Process

1. Load encrypted Amazon session from KV
2. Decrypt session cookies
3. Launch Puppeteer with cookies
4. Navigate to Amazon shopping list
5. Scrape items
6. Compare with existing Todoist tasks
7. Add new items to Todoist
8. Update last sync time

## Features

- ✅ **Serverless**: No servers to manage
- ✅ **Scalable**: Handles 1000s of users automatically
- ✅ **Secure**: Passwords never stored, only encrypted cookies
- ✅ **Cost-effective**: Pay only for usage
- ✅ **Global**: Deployed on Cloudflare's edge network
- ✅ **Reliable**: Built-in retries and error handling

## Limitations

- No VNC/live browser viewing (headless only)
- 2FA must be disabled on Amazon account
- Session expires require re-login
- Max 10 concurrent browsers (configurable with extra cost)

## Monitoring

View logs in real-time:

```bash
npm run tail
```

Check Queue stats:

```bash
npx wrangler queues list
```

## Scaling

The system auto-scales based on usage. Key limits:

- **Browser Rendering**: 10 concurrent browsers included
- **Workers**: Virtually unlimited requests
- **KV**: 1GB storage included
- **Queues**: 10,000 operations/day included

Beyond included limits, you pay per use (see cost estimate above).

## Security

- Passwords hashed with SHA-256
- Amazon sessions encrypted with AES-256-GCM
- JWT tokens for authentication
- HTTPS everywhere
- Secrets stored in Wrangler environment

## Troubleshooting

**Amazon login fails**: Check credentials, disable 2FA
**Session expires**: Reconnect Amazon in dashboard
**Sync not running**: Check cron trigger and queue status
**High costs**: Reduce sync frequency or optimize browser time
