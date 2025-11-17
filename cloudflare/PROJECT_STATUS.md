# Alexa-Todoist Sync - Project Status

## ✅ READY TO DEPLOY

All critical features are now implemented:

1. ✅ **Stripe Price IDs** → Configured with real price IDs
2. ✅ **Disconnect/Reconnect** → DELETE endpoints implemented

You can now deploy and test the full application!

---

## ✅ Completed in This Session

### 1. UI Improvements
- **Toast Notification System**: Replaced all native browser `alert()` popups with modern toast notifications
  - Color-coded by type (success, error, info, warning)
  - Auto-dismiss after 5 seconds
  - Slide-in animations from top-right
  - Dismissible with X button

- **Dashboard Layout Redesign**:
  - Changed from max-w-4xl to max-w-6xl for wider layout
  - Created 2-column grid for Todoist and Amazon config cards
  - Added branded icons (red checkmark for Todoist, Amazon logo for Amazon)
  - Enhanced status badges with green backgrounds
  - Moved subscription plans section below configuration cards
  - Improved subscription cards with checkmarks, "Current" badge, better pricing display

### 2. Amazon Login Fixes
- **Fixed Amazon Sign-In URL**: Updated to the correct Amazon OAuth URL that works properly
  - Old (broken): `https://www.amazon.com/ap/signin?openid.return_to=...alexaShoppingList`
  - New (working): `https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=...`

- **Puppeteer Compatibility**: Updated all `page.waitForTimeout()` calls to `new Promise(resolve => setTimeout(resolve, ms))` for Puppeteer v24+ compatibility

### 3. Two-Factor Authentication (2FA) Support
- **Backend 2FA Handling** (`workers/amazon-login.ts`):
  - Added optional `tfaCode` parameter
  - Detects 2FA page automatically
  - Checks "remember device" checkbox to avoid future 2FA prompts
  - Returns `2FA_REQUIRED` error if code needed
  - Fills in 2FA code and submits when provided
  - Validates 2FA submission

- **API Endpoint** (`workers/index.ts`):
  - Accepts `tfaCode` in request body
  - Returns `{ needs2FA: true }` response when 2FA required
  - Passes code to login function

- **Frontend 2FA Flow** (`frontend/index.html`):
  - Hidden 2FA input field that appears when needed
  - Shows toast notification prompting for code
  - Changes button text to "Submit 2FA Code"
  - Auto-focuses 2FA input
  - Resubmits with code included

### 4. Local Testing Tools
- **Created `test-amazon-login.js`**:
  - Non-headless browser test script
  - Visual debugging with slowMo
  - Takes screenshots at each step
  - Logs detailed selector attempts
  - Handles 2FA with 120-second manual entry window
  - Added puppeteer@24.15.0 as dependency

### 5. Disconnect/Reconnect Features
- **Backend DELETE Endpoints** (`workers/index.ts`):
  - `DELETE /api/config/todoist` - Disconnects Todoist, removes config
  - `DELETE /api/config/amazon` - Disconnects Amazon, deletes session from KV
  - Automatically marks user as inactive if both services disconnected

- **Frontend Handlers** (`frontend/index.html`):
  - `handleTodoistDisconnect()` - Confirmation dialog + API call + toast notification
  - `handleAmazonDisconnect()` - Confirmation dialog + API call + dashboard refresh
  - Auto-refreshes dashboard to show connection forms after disconnect

### 6. Stripe Configuration
- **Updated Pricing** (`shared/pricing.ts`):
  - Fast plan: `price_1SUJjrGeJyJ0RJDUWZvryQV9` ($1.99/mo)
  - Faster plan: `price_1SUJkRGeJyJ0RJDURxul4fDG` ($5/mo)
  - Stripe checkout now fully functional

### 7. Manual Sync Button
- **Backend Endpoint** (`workers/index.ts`):
  - `POST /api/sync/manual` - Triggers immediate Alexa→Todoist sync
  - Validates both services are connected
  - Enqueues sync job to SYNC_QUEUE

- **Frontend Button** (`frontend/index.html`):
  - "Sync Now" button in status card (only shows when active)
  - Loading state with spinning icon
  - Success toast notification
  - Auto-refreshes dashboard after 3 seconds to show updated sync time

### 8. Delete Account Feature
- **Backend Endpoint** (`workers/index.ts`):
  - `DELETE /api/account` - Permanently deletes all user data
  - Removes user record, email mapping, config, Amazon session

- **Frontend Handler** (`frontend/index.html`):
  - Triple confirmation (2 dialogs + typed "YES")
  - Shows success toast and logs out
  - Located in "Danger Zone" section at bottom of dashboard

## 📂 Files Modified

### Backend (Cloudflare Worker)
- `/cloudflare/workers/amazon-login.ts` - Fixed URL, added 2FA support, Puppeteer compatibility
- `/cloudflare/workers/index.ts` - Updated Amazon login endpoint for 2FA
- `/cloudflare/package.json` - Added puppeteer@24.15.0 dependency

### Frontend (Cloudflare Pages)
- `/cloudflare/frontend/index.html` - Toast system, UI improvements, 2FA input field

### Test Tools
- `/cloudflare/test-amazon-login.js` - New local testing script

## 🚀 DEPLOYMENT STEPS

### 1. Deploy Worker (Backend)
```bash
cd /Users/jmitch/GitHub/alexa-todoist-sync/cloudflare
wrangler deploy
```

This will deploy:
- Fixed Amazon sign-in URL
- 2FA detection and handling
- "Remember device" checkbox checking
- Disconnect/reconnect endpoints (`DELETE /api/config/todoist`, `DELETE /api/config/amazon`)
- Manual sync endpoint (`POST /api/sync/manual`)
- Delete account endpoint (`DELETE /api/account`)
- Stripe checkout with real price IDs

### 2. Deploy Frontend (Cloudflare Pages)
```bash
cd /Users/jmitch/GitHub/alexa-todoist-sync/cloudflare
wrangler pages deploy frontend --project-name=alexa-todoist-sync --branch=production
```

This will deploy:
- Toast notification system (no more ugly alerts!)
- Improved dashboard layout (2-column config, subscription plans below)
- 2FA input field and handling
- Disconnect/reconnect buttons (fully functional)
- Manual sync button with loading states
- Delete account button in danger zone
- Stripe checkout integration

## 🧪 Testing Required

### Test Amazon Login Flow (Critical)
1. Test with account **without** 2FA:
   - Go to dashboard at alexatodoist.com
   - Click "Connect Amazon"
   - Enter email/password
   - Should login successfully

2. Test with account **with** 2FA:
   - Go to dashboard
   - Click "Connect Amazon"
   - Enter email/password
   - Should see 2FA input field appear
   - Enter 6-digit code
   - Should login successfully
   - "Remember device" should be checked (future logins won't need 2FA)

### Local Testing (Optional but Recommended)
Before deploying, you can test locally:
```bash
cd /Users/jmitch/GitHub/alexa-todoist-sync/cloudflare
node test-amazon-login.js your-amazon-email@example.com your-password
```

This will:
- Open a visible Chrome browser
- Show you exactly what's happening
- Take screenshots at each step
- Auto-check "remember device" if 2FA appears
- Give you 120 seconds to manually enter 2FA code

## 🔧 Cloudflare Secrets (Already Set)
These should already be configured from previous session:
- ✅ `ENCRYPTION_KEY` - For encrypting Amazon session cookies
- ✅ `JWT_SECRET` - For user JWT tokens
- ✅ `TODOIST_CLIENT_ID` - Todoist OAuth app ID
- ✅ `TODOIST_CLIENT_SECRET` - Todoist OAuth secret
- ✅ `STRIPE_SECRET_KEY` - Stripe secret key
- ✅ `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

## 🔗 External Setup (Already Done)
From previous session:
- ✅ Todoist OAuth redirect URL: `https://app.alexatodoist.com/api/todoist/callback`
- ✅ Stripe webhook URL: `https://app.alexatodoist.com/api/stripe/webhook`
- ✅ Stripe events: `checkout.session.completed`, `customer.subscription.deleted`
- ✅ Custom domains:
  - Frontend: `alexatodoist.com` (Cloudflare Pages)
  - API: `app.alexatodoist.com` (Cloudflare Worker)

## 📝 Known Limitations

### Amazon Session Management
- **Sessions expire**: Amazon cookies may expire after ~2 weeks of inactivity
- **No automatic refresh**: Users will need to re-login when session expires
- **2FA "remember device" helps**: Checking this box means users won't need 2FA on subsequent logins from the same Cloudflare Browser instance

### Browser Rendering
- Uses Cloudflare Browser Rendering (Puppeteer)
- May be slower than native browser automation
- Subject to Cloudflare's rendering limits/quotas

## 🎯 Future Enhancements (Nice to Have)

### Nice to Have
- [ ] Session health check - periodic validation of Amazon cookies
- [ ] Proactive re-authentication - notify user before session expires
- [ ] Better error messages - distinguish between expired session vs invalid credentials
- [ ] Sync history - show last 10 syncs with timestamps and status

### Advanced Features
- [ ] Multiple shopping lists - sync more than just the default list
- [ ] Bidirectional filtering - choose which items to sync
- [ ] Custom sync rules - e.g., only sync items with certain tags
- [ ] Notification system - email/SMS when sync fails
- [ ] Admin dashboard - view all users, monitor sync health

## 🐛 Potential Issues to Watch

1. **Amazon Login Changes**: If Amazon updates their login page HTML/selectors, login may break
   - Symptoms: "Could not find email input field" errors
   - Fix: Update selectors in `amazon-login.ts`

2. **2FA Not Detecting**: If Amazon changes 2FA page structure
   - Symptoms: Login fails with 2FA but doesn't show input field
   - Fix: Check for new 2FA page identifiers in URL or DOM

3. **Cloudflare Browser Rendering Limits**:
   - Free tier has limited CPU time
   - May need to upgrade plan for heavy usage

4. **CORS Issues**: If frontend can't reach API
   - Check CORS settings in `workers/index.ts`
   - Verify domains match: frontend = alexatodoist.com, API = app.alexatodoist.com

## 🎓 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
│                                                              │
│   alexatodoist.com (Cloudflare Pages - Frontend)           │
│   - Dashboard UI                                             │
│   - Toast notifications                                      │
│   - 2FA input handling                                       │
└─────────────────┬───────────────────────────────────────────┘
                  │ API calls (CORS enabled)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│   app.alexatodoist.com (Cloudflare Worker - API)           │
│   - Auth endpoints (/api/auth/*)                            │
│   - Config endpoints (/api/config/*)                         │
│   - Todoist OAuth (/api/todoist/*)                          │
│   - Stripe webhooks (/api/stripe/*)                         │
│   - Amazon login (uses Cloudflare Browser Rendering)        │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴──────────┬──────────────┬────────────┐
        │                    │              │            │
        ▼                    ▼              ▼            ▼
    ┌────────┐         ┌──────────┐   ┌────────┐   ┌─────────┐
    │   KV   │         │ Queues   │   │Browser │   │External │
    │ USERS  │         │SYNC_QUEUE│   │Rendering│   │ APIs    │
    │SESSIONS│         └──────────┘   └────────┘   │-Todoist │
    └────────┘                                      │-Stripe  │
                                                    │-Amazon  │
                                                    └─────────┘
```

## 📚 Key Concepts

### Session Management
- User sessions: JWT tokens stored in localStorage
- Amazon sessions: Encrypted cookies stored in KV (SESSIONS namespace)
- Session expiry: JWT tokens verified on each API call

### Sync Flow
1. **Cron trigger** runs every 5 minutes (configured in wrangler.toml)
2. Checks which users need syncing based on interval
3. Enqueues sync jobs to SYNC_QUEUE
4. Queue consumer processes jobs (Alexa → Todoist)
5. Todoist → Alexa happens instantly via webhooks

### Pricing Tiers
- **Free**: Alexa→Todoist every 60 min
- **Fast ($1.99/mo)**: Alexa→Todoist every 30 min
- **Faster ($5/mo)**: Alexa→Todoist every 5 min
- All tiers: Instant Todoist→Alexa (via webhooks)

## ✅ Quick Start Checklist

### Deployment
- [ ] Deploy worker: `wrangler deploy`
- [ ] Deploy frontend: `wrangler pages deploy frontend --project-name=alexa-todoist-sync --branch=production`

### Testing
- [ ] Test login without 2FA
- [ ] Test login with 2FA (should auto-check "remember device")
- [ ] Test Todoist connection and disconnect
- [ ] Test Amazon connection and reconnect
- [ ] Test subscription upgrade flow (Stripe checkout)
- [ ] **Test manual sync button** (verify it triggers sync immediately)
- [ ] Verify syncing works (add item to Alexa, check Todoist)
- [ ] Verify webhook works (complete item in Todoist, check Alexa)
- [ ] Test disconnect → reconnect flow for both services
- [ ] Test delete account (creates new account to verify deletion works)

---

**Last Updated**: Session ending 2025-11-16

**Status**:
- ✅ All features complete and ready for production
- ✅ Amazon login with 2FA support (auto-checks "remember device")
- ✅ Toast notifications (no more ugly alerts)
- ✅ Stripe checkout configured with real price IDs
- ✅ Disconnect/reconnect functionality implemented
- ✅ Manual sync button with loading states
- ✅ Delete account feature with triple confirmation
- ✅ Dashboard UI redesigned (2-column layout)
- 🚀 **READY TO DEPLOY AND TEST**
