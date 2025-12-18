# Alexa to Todoist Sync

> Automatically sync items from your Alexa Shopping List to Todoist

## 🌐 Hosted Version (No Setup Required!)

**Don't want to host it yourself or run it locally?** Sign up for the hosted version at [alexatodoist.com](https://alexatodoist.com) and start syncing immediately - no configuration or deployment needed!

---

## 🎯 Choose Your Platform

This project supports multiple deployment options. Choose the one that fits your needs:

### 📱 macOS ⭐ **RECOMMENDED**
Run locally on your Mac with LaunchDaemon for automatic syncing.

**Status:** Tested and works great! Requires an always-on Mac to function.

**Best for:** Mac users who want a simple, reliable local solution and have a Mac that's always running

**Features:**
- ✅ **Persistent browser session** - stays logged in to Amazon
- ✅ **Reliable** - no ephemeral browser issues
- ✅ **Automatic syncing** - runs as a LaunchDaemon
- ✅ **2FA/Passkey support** - authenticate once and stay logged in
- ✅ **Bidirectional sync** - Alexa ↔ Todoist

**Installation:**
```bash
cd mac
./install.sh
```
The script will install dependencies, help configure credentials, and set up a LaunchDaemon for automatic syncing.

**First-Time Setup (Required for all users):**

The sync uses a **persistent browser profile** that saves your Amazon login session. You must log in once manually before running headless:

1. **Configure for manual login:**
   ```bash
   # Edit shared/config.json and set:
   "headless": false
   ```

2. **Run the sync script:**
   ```bash
   node shared/sync.js
   ```
   - A browser window will open and navigate to Amazon
   - Log in manually (complete 2FA/passkey if prompted)
   - Wait for "Shopping list page detected!" message in the terminal

3. **Stop the script:**
   - Press `Ctrl+C` to stop

4. **Switch to headless mode:**
   ```bash
   # Edit shared/config.json and set:
   "headless": true
   ```

5. **Start the LaunchDaemon:**
   ```bash
   launchctl load ~/Library/LaunchAgents/com.alexassync.plist
   ```
   - The service will now run automatically in the background using your saved session

**Why this works:** When `headless: false`, the script opens a visible browser and waits for you to log in manually - it won't try to automate the login. Your session is saved to a `.browser-profile/` directory, which persists across restarts. Subsequent runs (even headless) will use this saved session.

---

### ⚡ Cloudflare Workers ⚠️ **WORKS BUT NOT RECOMMENDED**
Serverless solution with Todoist OAuth webhooks for instant syncing.

**Status:** Works, but has reliability issues due to Amazon's security measures

**Best for:** Testing or experimentation only

**⚠️ Known Issues:**
- Amazon frequently logs you out due to ephemeral browser instances
- Requires frequent re-authentication (every few days or even daily)
- Can be annoying to maintain
- **We strongly recommend using the local Mac deployment instead**

**Features:**
- ✅ **Near-instant sync** via Todoist webhooks (queued with intelligent batching)
- ✅ **No server required** - runs entirely on Cloudflare
- ✅ **Todoist OAuth** - secure token-based authentication
- ✅ **Stripe integration** - optional paid tiers
- ✅ **Scalable** - handles thousands of users automatically
- ❌ **Unreliable Amazon sessions** - frequent logouts required

**Note:** Cloudflare deployment documentation is available in the `cloudflare/` directory. Check the code and configuration files for setup instructions.

---

### 💻 Windows ⚠️ **UNTESTED**
Run locally on Windows with Task Scheduler for automatic syncing.

**Status:** Completely untested. PRs welcome!

**Best for:** Windows users willing to test and contribute

**Note:** Uses polling (checks Todoist every 24 hours by default) instead of webhooks.

**Installation:**
```powershell
cd windows
.\install.ps1
```
Run as Administrator. The script will install dependencies, help configure credentials, and set up a Scheduled Task for automatic syncing.

---

### ☁️ Cloud / EC2 ⚠️ **UNTESTED**
Run on a cloud server (AWS EC2, DigitalOcean, etc.) for 24/7 operation.

**Status:** Completely untested. PRs welcome!

**Best for:** Users willing to test and contribute to cloud deployment

**Note:** Uses polling (checks Todoist every 24 hours by default) instead of webhooks.

**Installation:**
```bash
cd cloud
sudo ./install.sh
```
Supports Ubuntu, Debian, Amazon Linux, RHEL, and CentOS. The script will install Node.js, Chrome/Chromium, dependencies, help configure credentials, and set up a systemd service for automatic syncing.

---

## ✨ Features

- ✅ **Bidirectional sync**
  - Alexa → Todoist: New items synced every 5 minutes
  - Todoist → Alexa (Cloudflare): Completed tasks marked complete via webhooks (within 30 seconds)
  - Todoist → Alexa (macOS/Windows/Cloud): Completed tasks marked complete (configurable, default: every 24 hours)
- 🔄 **Smart tracking**: Re-add completed items and they'll sync again (uses `completedOnAlexa` flag)
- 🍪 **Persistent browser profile**: Maintains login with a saved browser profile (not just cookies) for reliable long-term sessions
- 🔐 **2FA support**: Works with Amazon's two-factor authentication
- 📊 **Detailed logging**: Timestamps and status for every operation
- 🧪 **Dry-run mode**: Test without actually syncing (macOS/Windows/Cloud only)
- ⚡ **Optimized batching**: Multiple webhook completions processed in one browser session (Cloudflare)

## 🚀 Quick Start

### macOS (Recommended)

The most reliable way to get started is with the macOS local deployment:

1. **Clone the repository**
   ```bash
   git clone https://github.com/itsthisjustin/alexa-todoist-sync.git
   cd alexa-todoist-sync/mac
   ```

2. **Run the installer**
   ```bash
   ./install.sh
   ```

3. **Log in manually (one-time setup)**
   ```bash
   # Make sure headless is false in shared/config.json, then:
   node shared/sync.js
   ```
   - A browser window opens - log in to Amazon manually
   - Complete any 2FA/passkey prompts
   - Wait for "Shopping list page detected!" in terminal
   - Press `Ctrl+C` to stop

4. **Switch to headless and start the service**
   ```bash
   # Set "headless": true in shared/config.json, then:
   launchctl load ~/Library/LaunchAgents/com.alexassync.plist
   ```

The service now runs automatically in the background using your saved browser session.

### Cloudflare (Not Recommended)

While the Cloudflare deployment works, it's not recommended due to frequent Amazon logouts. If you still want to try it:

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Clone and setup**
   ```bash
   git clone https://github.com/itsthisjustin/alexa-todoist-sync.git
   cd alexa-todoist-sync/cloudflare
   npm install
   ```

3. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

4. **Create resources**
   ```bash
   # Create KV namespaces
   wrangler kv:namespace create SESSIONS
   wrangler kv:namespace create USERS

   # Create queue
   wrangler queues create alexa-todoist-sync-queue
   ```

5. **Configure wrangler.toml**
   - Copy `wrangler.toml.example` to `wrangler.toml`
   - Update the KV namespace IDs and queue name with the values from step 4

6. **Set secrets**
   ```bash
   # Generate encryption key
   openssl rand -base64 32 | wrangler secret put ENCRYPTION_KEY

   # Generate JWT secret
   openssl rand -base64 32 | wrangler secret put JWT_SECRET
   ```

7. **Set up Todoist OAuth** (optional but recommended)
   - Set the client ID and secret:
     ```bash
     wrangler secret put TODOIST_CLIENT_ID
     wrangler secret put TODOIST_CLIENT_SECRET
     ```

8. **Set up Stripe** (optional - for paid tiers)
   - Set the keys:
     ```bash
     wrangler secret put STRIPE_SECRET_KEY
     wrangler secret put STRIPE_WEBHOOK_SECRET
     ```

9. **Deploy**
   ```bash
   wrangler deploy
   ```

10. **Add queue consumer** (required due to wrangler limitation)
    ```bash
    wrangler queues consumer add alexa-todoist-sync-queue alexa-todoist-sync --batch-size 10 --message-retries 3 --batch-timeout 30
    ```
    Note: The queue consumer configuration in `wrangler.toml` doesn't always apply correctly during deployment, so it must be added manually via CLI after deployment.

11. **Deploy frontend**
    - Update `API_URL` in `frontend/index.html` with your Worker URL
    - Deploy to Cloudflare Pages:
      ```bash
      wrangler pages deploy frontend
      ```

**Note:** Check the `cloudflare/` directory for configuration templates and code.

### Other Platforms

1. **Choose your platform** (macOS, Windows, or Cloud/EC2)
2. **Follow the installation guide** for your chosen platform
3. **Configure your credentials** (Amazon + Todoist)
4. **Start syncing!**

## 📋 Prerequisites

### Cloudflare
- Cloudflare account
- Wrangler CLI
- Amazon account with Alexa Shopping List
- Todoist account (OAuth recommended, or API token)

### macOS / Windows / Cloud
- Node.js 18 or higher
- Amazon account with Alexa Shopping List
- Todoist account with API token

## 🔧 How It Works

```
Alexa Shopping List  ──────→  Todoist Project
        ↑                            │
        │                            │
        └────────────────────────────┘
         (Completed items sync back)
```

### Cloudflare (Webhook-based - Near-Instant)
1. **New items**: Added to Alexa Shopping List → Checked every 5 minutes → Automatically appear in Todoist
2. **Completed tasks**: Checked off in Todoist → **Webhook queued** → Marked complete in Alexa (within 30 seconds, batched per user)
3. **Re-added items**: Items you complete and re-add to Alexa will sync again
4. **Authentication**: Uses Todoist OAuth for secure, token-based auth (no API tokens to manage)
5. **Intelligent batching**: Multiple items completed quickly are processed in one browser session for efficiency

### macOS / Windows / Cloud (Polling-based)
1. **New items**: Added to Alexa Shopping List → Checked every 5 minutes → Automatically appear in Todoist
2. **Completed tasks**: Checked off in Todoist → **Polled once per day** (configurable) → Marked complete in Alexa
3. **Re-added items**: Items you complete and re-add to Alexa will sync again
4. **Authentication**: Requires Todoist API token

## 🔑 Getting Your Todoist Credentials

### API Token

1. Go to [Todoist Settings → Integrations](https://todoist.com/prefs/integrations)
2. Scroll to "API token" section
3. Copy your API token

### Project ID

1. Open Todoist in your browser
2. Click on the project you want to use
3. Look at the URL: `https://todoist.com/app/project/1234567890`
4. The number at the end (`1234567890`) is your project ID

## ⚙️ Configuration

All platforms use the same `config.json` format:

```json
{
  "amazon": {
    "email": "your-email@example.com",
    "password": "your-password"
  },
  "todoist": {
    "apiToken": "your-todoist-api-token",
    "projectId": "your-project-id"
  },
  "options": {
    "headless": true,
    "checkIntervalMinutes": 5,
    "todoistCheckIntervalHours": 24,
    "stateFile": "sync-state.json"
  }
}
```

### Options Explained

| Option | Description | Default |
|--------|-------------|---------|
| `headless` | Run browser in headless mode | `true` |
| `checkIntervalMinutes` | How often the script runs (via scheduler) | `5` |
| `todoistCheckIntervalHours` | How often to check Todoist for completed tasks | `24` |
| `stateFile` | Where to store sync state | `"sync-state.json"` |

## 🛠️ Manual Usage

All platforms support these commands:

### Run a one-time sync:
```bash
node shared/sync.js
```

### Test without syncing (dry run):
```bash
node shared/sync.js --dry-run
```

### View logs:
```bash
# macOS/Linux/Cloud
tail -f logs/sync.log

# Windows (PowerShell)
Get-Content logs\sync.log -Wait -Tail 50
```

## 🔒 Security Notes

- Your credentials are stored locally in `config.json`
- Session cookies are stored locally in `cookies.json`
- Browser profile data is stored in `.browser-profile/` (contains your Amazon session)
- None of these files should be committed to version control
- The `.gitignore` file protects against accidental commits
- Consider using a dedicated Todoist project for this sync

**Important:** Never share your `config.json`, `cookies.json`, or `.browser-profile/` directory.

## 🐛 Troubleshooting

### "Login required" every time

Your session might have expired. Re-authenticate manually:
1. Set `"headless": false` in `config.json`
2. Run `node shared/sync.js`
3. Log in manually in the browser window
4. Wait for "Shopping list page detected!" message
5. Press `Ctrl+C` to stop
6. Set `"headless": true` in `config.json`
7. Restart the service

If issues persist, try deleting the browser profile to start fresh:
```bash
rm -rf shared/.browser-profile
rm shared/cookies.json
```
Then repeat the manual login steps above.

### Items not syncing

1. Check logs for errors
2. Run in dry-run mode to test: `node shared/sync.js --dry-run`
3. Verify your Todoist API token and project ID are correct
4. Make sure you have items in your Alexa Shopping List

### Amazon page structure changed

The script uses multiple selectors to handle page changes, but if Amazon significantly updates their interface:
1. Open an issue on GitHub with details
2. Or update the selectors in `shared/sync.js` (look for the `extractItems` function)

## 🐞 Found a bug or want to request a feature?

We'd love to hear from you! Please [open an issue on GitHub](https://github.com/itsthisjustin/alexa-todoist-sync/issues) to:

- 🐛 Report bugs
- ✨ Request new features
- 💡 Suggest improvements
- 📖 Ask questions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### 🚨 Testing Needed!

The **Windows** and **Cloud/EC2** deployment options are completely untested and need community help:

- ⚠️ **Windows**: The installation scripts and Task Scheduler integration have not been tested
- ⚠️ **Cloud/EC2**: The cloud deployment scripts and systemd services have not been tested

If you're willing to test these platforms, we'd love your help! Please:
1. Try the installation on your platform
2. Report any issues you encounter
3. Submit PRs with fixes or improvements

Your contributions will help make these platforms production-ready for everyone! 🙌

## 📝 License

MIT

## 🙏 Acknowledgments

- Built with [Puppeteer](https://pptr.dev/) for web automation
- Uses the [Todoist REST API](https://developer.todoist.com/rest/v2/)

**Questions or issues?** Please open an issue on GitHub!
