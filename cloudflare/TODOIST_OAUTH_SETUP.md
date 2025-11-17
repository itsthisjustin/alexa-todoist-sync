# Todoist OAuth App Setup Guide

This guide shows you how to create a Todoist OAuth app for seamless user authentication.

## Why OAuth?

Instead of users manually copying API tokens and project IDs, OAuth provides a one-click "Connect Todoist" experience:

**Before (Manual)**:
1. User goes to Todoist settings
2. Copies API token
3. Finds project ID
4. Pastes both into app
5. Clicks connect

**After (OAuth)**:
1. User clicks "Connect Todoist"
2. Authorizes app
3. Selects project from list
4. Done! ✅

## Step 1: Create Todoist OAuth App

1. Go to [Todoist App Management Console](https://todoist.com/app_console)
2. Click **Create a new app**
3. Fill in the form:
   - **App name**: Your App Name (e.g., "Alexa Todoist Sync")
   - **App description**: Brief description of what your app does
   - **OAuth redirect URL**: `https://your-worker.workers.dev/api/todoist/callback`
     - For local development: `http://localhost:8787/api/todoist/callback`
   - **App URL**: Your app's homepage (optional)
   - **Privacy policy URL**: Link to privacy policy (optional)
4. Click **Create app**

## Step 2: Get OAuth Credentials

After creating the app, you'll see:

- **Client ID**: A long alphanumeric string (e.g., `abc123def456...`)
- **Client Secret**: A secret string for token exchange

**Keep these secret!** Never commit them to git.

## Step 3: Add Credentials to Cloudflare

Add your OAuth credentials as Cloudflare Worker secrets:

```bash
# Add Client ID
wrangler secret put TODOIST_CLIENT_ID
# Paste your client ID when prompted

# Add Client Secret
wrangler secret put TODOIST_CLIENT_SECRET
# Paste your client secret when prompted
```

## Step 4: Configure OAuth Scope

Our app requests the following scope:

- **`data:read_write`** - Read and write access to user's tasks, projects, and labels

This is required to:
- Read user's projects (for project selection)
- Register webhooks
- Sync tasks between Alexa and Todoist

## Step 5: Test OAuth Flow

### Development Testing

1. Start local worker:
   ```bash
   wrangler dev
   ```

2. Visit your app and click "Connect Todoist"

3. You'll be redirected to Todoist authorization page

4. Authorize the app

5. You should be redirected back to your app and see project selection

### Production Testing

1. Deploy your worker:
   ```bash
   wrangler deploy
   ```

2. Update OAuth redirect URL in Todoist App Console:
   - Change from `http://localhost:8787/...`
   - To `https://your-worker.workers.dev/...`

3. Test the full flow in production

## OAuth Flow Diagram

```
┌─────────┐                                    ┌──────────┐
│  User   │                                    │ Todoist  │
└────┬────┘                                    └────┬─────┘
     │                                              │
     │  1. Click "Connect Todoist"                  │
     │─────────────────────────────────────────────>│
     │                                              │
     │  2. Redirect to Todoist OAuth                │
     │<─────────────────────────────────────────────│
     │                                              │
     │  3. User authorizes app                      │
     │─────────────────────────────────────────────>│
     │                                              │
     │  4. Redirect back with code                  │
     │<─────────────────────────────────────────────│
     │                                              │
┌────▼────┐                                    ┌────▼─────┐
│ Worker  │  5. Exchange code for token        │ Todoist  │
│         │───────────────────────────────────>│   API    │
│         │<───────────────────────────────────│          │
│         │  6. Return access token            │          │
└────┬────┘                                    └──────────┘
     │
     │  7. Fetch user's projects
     │─────────────────────────────────────────────>
     │<─────────────────────────────────────────────
     │  8. Show project selection
     │
     │  9. User selects project
     │
     │  10. Register webhook & complete setup
```

## Implementation Details

### 1. Initiate OAuth (`GET /api/todoist/connect`)

```typescript
const authUrl = new URL('https://todoist.com/oauth/authorize');
authUrl.searchParams.set('client_id', TODOIST_CLIENT_ID);
authUrl.searchParams.set('scope', 'data:read_write');
authUrl.searchParams.set('state', randomState); // CSRF protection
```

### 2. Handle Callback (`GET /api/todoist/callback`)

```typescript
// Exchange code for token
POST https://todoist.com/oauth/access_token
{
  client_id: TODOIST_CLIENT_ID,
  client_secret: TODOIST_CLIENT_SECRET,
  code: code
}

// Response:
{
  access_token: "abc123...",
  token_type: "Bearer"
}
```

### 3. Fetch Projects (`GET /api/todoist/projects`)

```typescript
GET https://api.todoist.com/rest/v2/projects
Authorization: Bearer {access_token}
```

### 4. Complete Setup (`POST /api/todoist/complete`)

- Save access token and project ID to user config
- Register webhook for instant sync
- Clean up temporary OAuth state

## Security Best Practices

### CSRF Protection

We use a `state` parameter to prevent CSRF attacks:

```typescript
// Generate random state
const state = crypto.randomUUID();

// Store temporarily
await kv.put(`oauth_state:${state}`, userId, { expirationTtl: 600 });

// Verify on callback
const storedUserId = await kv.get(`oauth_state:${state}`);
if (!storedUserId) {
  return error('Invalid state');
}
```

### Token Storage

- Tokens are stored in Cloudflare KV
- Not encrypted (already secure OAuth tokens)
- Can be revoked by user in Todoist settings

### Token Revocation

Users can revoke access anytime:
1. Go to Todoist Settings → Integrations
2. Find your app
3. Click "Revoke Access"

Your app should handle revoked tokens gracefully:
```typescript
const response = await fetch(todoistApi, {
  headers: { Authorization: `Bearer ${token}` }
});

if (response.status === 401) {
  // Token revoked or expired
  // Clear user config and ask to reconnect
}
```

## Webhook Registration

After OAuth completes, we automatically register a webhook:

```typescript
POST https://api.todoist.com/sync/v9/sync
Authorization: Bearer {access_token}

{
  "commands": [{
    "type": "webhook_add",
    "args": {
      "url": "https://your-worker.workers.dev/api/todoist/webhook",
      "event_name": "item:completed"
    }
  }]
}
```

This enables instant sync when users complete items in Todoist!

## Troubleshooting

### "Invalid client_id"

- Check that `TODOIST_CLIENT_ID` is set correctly
- Verify it matches the Client ID in Todoist App Console

### "Redirect URI mismatch"

- OAuth redirect URL must **exactly** match what's configured in Todoist App Console
- Include protocol (`https://`), domain, and path
- No trailing slash

### "Invalid state parameter"

- State may have expired (10 minute TTL)
- CSRF protection triggered - make sure cookies/localStorage are enabled
- Try the flow again

### Token exchange fails

- Check `TODOIST_CLIENT_SECRET` is correct
- Ensure you're using the authorization `code` from callback (not the access token)
- Code can only be used once - if it fails, restart OAuth flow

## Testing Checklist

- [ ] OAuth app created in Todoist App Console
- [ ] Client ID and Secret added to Cloudflare secrets
- [ ] Redirect URL configured correctly
- [ ] "Connect Todoist" button works
- [ ] Redirects to Todoist authorization page
- [ ] After authorization, redirects back to app
- [ ] Project selection modal appears
- [ ] Selecting project completes setup
- [ ] Todoist config shows as connected
- [ ] Webhook registered successfully (check Todoist App Console)
- [ ] Test completing an item in Todoist → should delete from Alexa

## Comparison: Manual vs OAuth

| Aspect | Manual Token | OAuth |
|--------|-------------|-------|
| User steps | 5+ steps | 3 clicks |
| Setup time | 2-3 minutes | 15 seconds |
| Error prone | Yes (copy/paste) | No |
| User experience | Confusing | Seamless |
| Token security | User sees it | Hidden |
| Revocation | Manual in Todoist | Via app or Todoist |
| Professional | No | Yes ✅ |

## Next Steps

After setting up OAuth:

1. Test the complete flow end-to-end
2. Add error handling for revoked tokens
3. Consider adding a "Disconnect" button
4. Monitor webhook delivery in logs
5. Add usage analytics to track OAuth conversion

## Resources

- [Todoist OAuth Documentation](https://developer.todoist.com/guides/#oauth)
- [Todoist App Management Console](https://todoist.com/app_console)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
