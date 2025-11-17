# Todoist Webhooks Integration

## Overview

Instead of polling Todoist every X minutes (which uses browser hours and costs money), we use **Todoist webhooks** for instant, event-driven sync. When you complete an item in Todoist, it's **immediately** removed from your Alexa shopping list.

## Benefits

✅ **Instant sync** - No waiting for polling interval
✅ **Zero cost** - Webhooks are free (no browser hours used)
✅ **Better UX** - Real-time updates feel magical
✅ **Simpler pricing** - All tiers get instant Todoist→Alexa sync

## How It Works

1. User connects their Todoist account
2. App automatically registers a webhook with Todoist API
3. When user completes an item in Todoist, Todoist sends a webhook to our Worker
4. Worker finds the item in Amazon Alexa list and deletes it
5. Done! Instant sync with zero polling

## Architecture

```
Todoist (item completed)
    ↓ webhook event
Cloudflare Worker (/api/todoist/webhook)
    ↓ decrypt Amazon session
Puppeteer browser
    ↓ find and delete item
Amazon Alexa Shopping List
```

## Webhook Registration

Webhooks are automatically registered when a user connects their Todoist account.

**Endpoint**: `POST /api/config/todoist`

```javascript
// After validating Todoist API token
const webhookUrl = `${origin}/api/todoist/webhook`;
await registerTodoistWebhook(apiToken, webhookUrl);
```

**API Call**:
```javascript
POST https://api.todoist.com/sync/v9/sync
Authorization: Bearer {apiToken}

{
  "commands": [{
    "type": "webhook_add",
    "temp_id": "uuid",
    "args": {
      "url": "https://your-worker.workers.dev/api/todoist/webhook",
      "event_name": "item:completed"
    }
  }]
}
```

**What gets registered**:
- **Event**: `item:completed`
- **Callback URL**: `https://your-worker.workers.dev/api/todoist/webhook`

### Manual Registration (Fallback)

If automatic registration fails, users can register webhooks manually:

1. Go to [Todoist App Console](https://todoist.com/app/settings/integrations)
2. Create new webhook integration
3. Set callback URL: `https://your-worker.workers.dev/api/todoist/webhook`
4. Select events: `item:completed`
5. Save webhook

## Webhook Handler

**Endpoint**: `POST /api/todoist/webhook`

**Flow**:
1. Receive webhook from Todoist with event data
2. Verify signature (optional but recommended)
3. Extract item name and project ID
4. Find user by project ID (lookup in KV)
5. Decrypt Amazon session
6. Launch Puppeteer and delete item from Alexa list

## Event Format

Todoist sends webhook POST requests with these headers:

**Headers**:
- `User-Agent`: `Todoist-Webhooks`
- `X-Todoist-Hmac-SHA256`: HMAC signature for verification
- `X-Todoist-Delivery-ID`: Unique delivery ID for idempotency
- `Content-Type`: `application/json`

**Payload**:
```json
{
  "event_name": "item:completed",
  "user_id": 12345678,
  "event_data": {
    "id": "1234567890",
    "content": "Buy milk",
    "project_id": "2203306141",
    "user_id": "12345678",
    "added_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:30:00Z",
    "labels": [],
    "priority": 1
  }
}
```

**Available Events**:
- `item:added` - Item created
- `item:updated` - Item modified
- `item:deleted` - Item deleted
- `item:completed` - Item marked complete ✅ (what we use)

## Security

### Webhook Signature Verification

Todoist includes an HMAC signature in the `X-Todoist-Hmac-SHA256` header. To verify:

```typescript
const signature = c.req.header('x-todoist-hmac-sha256');
// Verify signature matches payload
```

Currently, we just check that the header exists. For production, implement full HMAC verification.

## Testing Webhooks Locally

### Option 1: ngrok

```bash
# Install ngrok
brew install ngrok

# Start your local worker
wrangler dev

# In another terminal, expose it
ngrok http 8787

# Use the ngrok URL as your webhook callback
# e.g., https://abc123.ngrok.io/api/todoist/webhook
```

### Option 2: Deploy to Cloudflare

```bash
wrangler deploy

# Your webhook URL will be:
# https://your-worker.workers.dev/api/todoist/webhook
```

### Trigger Test Event

In Todoist app:
1. Add an item to your synced project
2. Complete the item ✓
3. Check Cloudflare Worker logs: `wrangler tail`
4. Verify item was deleted from Alexa list

## Webhook Management

### List Registered Webhooks

```bash
curl https://api.todoist.com/sync/v9/sync \
  -H "Authorization: Bearer YOUR_TODOIST_TOKEN" \
  -d 'sync_token=*&resource_types=["webhooks"]'
```

### Delete a Webhook

```bash
curl https://api.todoist.com/sync/v9/sync \
  -H "Authorization: Bearer YOUR_TODOIST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {
        "type": "webhook_delete",
        "uuid": "WEBHOOK_ID"
      }
    ]
  }'
```

## Troubleshooting

### Webhook not firing

1. **Check webhook is registered**
   ```bash
   curl https://api.todoist.com/sync/v9/sync \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d 'sync_token=*&resource_types=["webhooks"]'
   ```

2. **Check webhook URL is accessible**
   ```bash
   curl -X POST https://your-worker.workers.dev/api/todoist/webhook \
     -H "Content-Type: application/json" \
     -d '{"event_name": "item:completed", "event_data": {"id": "123", "content": "test"}}'
   ```

3. **Check Worker logs**
   ```bash
   wrangler tail
   # Complete an item in Todoist
   # You should see webhook event logged
   ```

### Item not deleted from Alexa

1. **Check Amazon session is valid**
   - Session may have expired
   - Re-login to Amazon through app

2. **Check item name matching**
   - Item names must match exactly
   - Case-insensitive comparison is used

3. **Check browser automation**
   - Amazon may have changed their HTML structure
   - Update selectors in `todoist-webhook.ts`

### Webhook hitting rate limits

Todoist webhooks have rate limits:
- **Max 100 events/minute** per user
- If you complete 100 items in 1 minute, some webhooks may be dropped

Solution: Queue webhooks in Cloudflare Queue for processing

## Cost Analysis

### Before (Polling)

- Check Todoist every 60 minutes (free tier)
- 24 checks/day × 30 days = 720 checks/month
- ~10 seconds per check = 7,200 seconds = 2 hours
- **Cost**: $0.09 × 2 = **$0.18/user/month**

### After (Webhooks)

- 0 polling (webhooks are instant)
- Only use browser hours when item is actually completed
- Average user completes ~10 items/month
- 10 items × 10 seconds = 100 seconds = 0.03 hours
- **Cost**: $0.09 × 0.03 = **$0.0027/user/month**

**Savings**: 98.5% reduction in Todoist→Alexa sync costs! 🎉

## Implementation Details

### File: `cloudflare/workers/routes/todoist-webhook.ts`

Key functions:

1. **`handleTodoistWebhook()`** - Main webhook handler
2. **`findUserByProjectId()`** - Lookup user from Todoist project
3. **`deleteFromAlexaList()`** - Use Puppeteer to delete item
4. **`registerTodoistWebhook()`** - Register webhook with Todoist API

### File: `cloudflare/workers/index.ts`

Route registration:
```typescript
app.post('/api/todoist/webhook', handleTodoistWebhook);
```

Auto-registration on Todoist connect:
```typescript
app.post('/api/config/todoist', async (c) => {
  // ... validate token
  await registerTodoistWebhook(apiToken, projectId, webhookUrl);
});
```

## Future Enhancements

### 1. Support More Events

Currently only handles `item:completed`. Could also handle:
- `item:added` - Sync new Todoist items → Alexa
- `item:updated` - Update item text
- `item:deleted` - Remove from Alexa

### 2. Batch Processing

For power users who complete many items:
- Queue webhook events
- Batch delete from Alexa (open browser once, delete multiple)
- Reduces browser hours further

### 3. Bi-directional Instant Sync

Use Alexa's API (if available) to get webhooks when items are added
- Currently polling Alexa every 5-60 minutes
- With webhooks, could be instant both directions

### 4. Webhook Health Monitoring

- Track successful vs failed webhook deliveries
- Alert user if webhook stops working
- Auto-re-register webhook if it gets deleted

## Summary

Todoist webhooks are a **game changer** for this app:

| Aspect | Before (Polling) | After (Webhooks) |
|--------|-----------------|------------------|
| Sync speed | 5min - 24hr | **Instant** |
| Cost/user | $0.18/mo | **$0.003/mo** |
| User experience | Delayed | **Real-time** |
| Complexity | Medium | **Same** |

**Recommendation**: Use webhooks for all event-driven sync scenarios. Only use polling when the service doesn't support webhooks (like Alexa).
