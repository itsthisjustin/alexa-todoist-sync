# Alexa to Todoist Sync

> Automatically sync items from your Alexa Shopping List to Todoist

## 🎯 Choose Your Platform

This project supports multiple deployment options. Choose the one that fits your needs:

### ⚡ [Cloudflare Workers](./cloudflare/README.md) ⭐ **RECOMMENDED**
Serverless, fully-managed solution with Todoist OAuth webhooks for instant syncing.

**Best for:** Anyone who wants a fully-automated, maintenance-free solution

**Features:**
- ✅ **Instant sync** via Todoist webhooks (no polling!)
- ✅ **No server required** - runs entirely on Cloudflare
- ✅ **Todoist OAuth** - secure token-based authentication
- ✅ **Stripe integration** - optional paid tiers
- ✅ **Scalable** - handles thousands of users automatically
- ✅ **Always on** - 24/7 operation with zero maintenance

[📖 Cloudflare Deployment Guide →](./cloudflare/README.md)

---

### 📱 [macOS](./mac/README.md) ✅ **TESTED**
Run locally on your Mac with LaunchDaemon for automatic syncing.

**Status:** Tested and works great! Requires an always-on Mac to function.

**Best for:** Mac users who want a simple, local solution and have a Mac that's always running

**Note:** Uses polling (checks Todoist every 24 hours by default) instead of webhooks.

[📖 macOS Installation Guide →](./mac/README.md)

---

### 💻 [Windows](./windows/README.md) ⚠️ **UNTESTED**
Run locally on Windows with Task Scheduler for automatic syncing.

**Status:** Completely untested. PRs welcome!

**Best for:** Windows users willing to test and contribute

**Note:** Uses polling (checks Todoist every 24 hours by default) instead of webhooks.

[📖 Windows Installation Guide →](./windows/README.md)

---

### ☁️ [Cloud / EC2](./cloud/README.md) ⚠️ **UNTESTED**
Run on a cloud server (AWS EC2, DigitalOcean, etc.) for 24/7 operation.

**Status:** Completely untested. PRs welcome!

**Best for:** Users willing to test and contribute to cloud deployment

**Note:** Uses polling (checks Todoist every 24 hours by default) instead of webhooks.

[📖 Cloud Installation Guide →](./cloud/README.md)

---

## ✨ Features

- ✅ **Bidirectional sync**
  - Alexa → Todoist: New items synced every 5 minutes
  - Todoist → Alexa: Completed tasks marked complete (configurable, default: every 24 hours)
- 🔄 **Smart tracking**: Re-add completed items and they'll sync again
- 🍪 **Persistent sessions**: Maintains login with saved cookies
- 🔐 **2FA support**: Works with Amazon's two-factor authentication
- 📊 **Detailed logging**: Timestamps and status for every operation
- 🧪 **Dry-run mode**: Test without actually syncing
- ⚡ **Optimized**: Configurable polling intervals to minimize API usage

## 🚀 Quick Start

### Cloudflare (Recommended)

The easiest way to get started is with the Cloudflare Workers deployment:

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
   - Follow [TODOIST_OAUTH_SETUP.md](./cloudflare/TODOIST_OAUTH_SETUP.md)
   - Set the client ID and secret:
     ```bash
     wrangler secret put TODOIST_CLIENT_ID
     wrangler secret put TODOIST_CLIENT_SECRET
     ```

8. **Set up Stripe** (optional - for paid tiers)
   - Follow [STRIPE_SETUP.md](./cloudflare/STRIPE_SETUP.md)
   - Set the keys:
     ```bash
     wrangler secret put STRIPE_SECRET_KEY
     wrangler secret put STRIPE_WEBHOOK_SECRET
     ```

9. **Deploy**
   ```bash
   wrangler deploy
   ```

10. **Deploy frontend**
    - Update `API_URL` in `frontend/index.html` with your Worker URL
    - Deploy to Cloudflare Pages:
      ```bash
      wrangler pages deploy frontend
      ```

**📖 Full guide:** [Cloudflare Deployment Guide](./cloudflare/README.md)

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

### Cloudflare (Webhook-based - Instant)
1. **New items**: Added to Alexa Shopping List → Checked every 5 minutes → Automatically appear in Todoist
2. **Completed tasks**: Checked off in Todoist → **Instant webhook** → Marked complete in Alexa immediately
3. **Re-added items**: Items you complete and re-add to Alexa will sync again
4. **Authentication**: Uses Todoist OAuth for secure, token-based auth (no API tokens to manage)

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
3. Look at the URL: `https://todoist.com/app/project/2275365528`
4. The number at the end (`2275365528`) is your project ID

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

## 📁 Project Structure

```
alexa-todoist-sync/
├── cloudflare/            # Cloudflare Workers (serverless, recommended)
│   ├── README.md          # Cloudflare deployment guide
│   ├── frontend/          # Static frontend (HTML/JS)
│   ├── workers/           # Worker scripts
│   ├── shared/            # Shared types and utilities
│   ├── wrangler.toml.example  # Cloudflare configuration template
│   └── package.json       # Dependencies
├── mac/                   # macOS-specific files (tested)
│   ├── README.md          # macOS installation guide
│   ├── install.sh         # macOS installation script
│   └── com.alexassync.plist  # LaunchDaemon configuration
├── windows/               # Windows-specific files (untested)
│   ├── README.md          # Windows installation guide
│   └── install.ps1        # Windows installation script
├── shared/                # Shared files for local deployments
│   ├── sync.js            # Main sync script
│   └── config.json.template  # Configuration template
├── package.json           # Node.js dependencies
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

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
- Neither file should be committed to version control
- The `.gitignore` file protects against accidental commits
- Consider using a dedicated Todoist project for this sync

**Important:** Never share your `config.json` or `cookies.json` files.

## 🐛 Troubleshooting

### "Login required" every time

Your cookies might be expiring:
1. Delete `cookies.json`
2. Run the sync script to login fresh
3. Check if Amazon is requiring additional verification

### Items not syncing

1. Check logs for errors
2. Run in dry-run mode to test: `node shared/sync.js --dry-run`
3. Verify your Todoist API token and project ID are correct
4. Make sure you have items in your Alexa Shopping List

### Amazon page structure changed

The script uses multiple selectors to handle page changes, but if Amazon significantly updates their interface:
1. Open an issue on GitHub with details
2. Or update the selectors in `shared/sync.js` (look for the `extractItems` function)

### Platform-Specific Issues

See the README for your specific platform:
- [macOS Troubleshooting](./mac/README.md#troubleshooting)
- [Windows Troubleshooting](./windows/README.md#troubleshooting)
- [Cloud Troubleshooting](./cloud/README.md#troubleshooting)

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

---

## Platform Comparison

| Feature | Cloudflare | macOS | Windows | Cloud/EC2 |
|---------|------------|-------|---------|-----------|
| **Status** | ⭐ Production Ready | ✅ Tested | ⚠️ Untested | ⚠️ Untested |
| **Setup Complexity** | Moderate | Easy | Easy | Moderate |
| **Always On** | ✅ 24/7 | Only when computer is running | Only when computer is running | ✅ 24/7 |
| **Sync Method** | Todoist Webhooks (instant) | Polling | Polling | Polling |
| **Todoist Auth** | OAuth (secure) | API Token | API Token | API Token |
| **Cost** | Free tier, then ~$5-25/user/month | Free | Free | ~$4-10/month |
| **Requires Computer** | ❌ | ✅ (Always-on Mac) | ✅ | ❌ |
| **Scalable** | ✅ Unlimited users | Single user | Single user | Single user |
| **Maintenance** | Zero | Minimal | Minimal | Moderate |
| **Best For** | Anyone wanting a modern, scalable solution | Mac users with always-on computer | Windows testers & contributors | Cloud testers & contributors |

---

**Questions or issues?** Please open an issue on GitHub!
