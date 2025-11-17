# Alexa to Todoist Sync

> Automatically sync items from your Alexa Shopping List to Todoist

## 🎯 Choose Your Platform

This project supports multiple deployment options. Choose the one that fits your needs:

### 📱 [macOS](./mac/README.md)
Run locally on your Mac with LaunchDaemon for automatic syncing.

**Best for:** Mac users who want a simple, local solution

[📖 macOS Installation Guide →](./mac/README.md)

---

### 💻 [Windows](./windows/README.md)
Run locally on Windows with Task Scheduler for automatic syncing.

**Best for:** Windows users who want a simple, local solution

[📖 Windows Installation Guide →](./windows/README.md)

---

### ☁️ [Cloud / EC2](./cloud/README.md)
Run on a cloud server (AWS EC2, DigitalOcean, etc.) for 24/7 operation.

**Best for:** Users who want always-on syncing without keeping a personal computer running

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

1. **Choose your platform** (see above)
2. **Follow the installation guide** for your chosen platform
3. **Configure your credentials** (Amazon + Todoist)
4. **Start syncing!**

## 📋 Prerequisites

All platforms require:

- Node.js 18 or higher
- Amazon account with Alexa Shopping List
- Todoist account with API access

## 🔧 How It Works

```
Alexa Shopping List  ──────→  Todoist Project
        ↑                            │
        │                            │
        └────────────────────────────┘
         (Completed items sync back)
```

1. **New items**: Added to Alexa Shopping List → Automatically appear in Todoist
2. **Completed tasks**: Checked off in Todoist → Marked complete in Alexa (once per day by default)
3. **Re-added items**: Items you complete and re-add to Alexa will sync again

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
├── mac/                    # macOS-specific files
│   ├── README.md          # macOS installation guide
│   ├── install.sh         # macOS installation script
│   └── com.alexassync.plist  # LaunchDaemon configuration
├── windows/               # Windows-specific files
│   ├── README.md          # Windows installation guide
│   └── install.ps1        # Windows installation script
├── cloud/                 # Cloud/EC2-specific files
│   ├── README.md          # Cloud installation guide
│   └── install.sh         # Cloud installation script
├── shared/                # Platform-agnostic files
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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT

## 🙏 Acknowledgments

- Built with [Puppeteer](https://pptr.dev/) for web automation
- Uses the [Todoist REST API](https://developer.todoist.com/rest/v2/)

---

## Platform Comparison

| Feature | macOS | Windows | Cloud |
|---------|-------|---------|-------|
| **Setup Complexity** | Easy | Easy | Moderate |
| **Always On** | Only when computer is running | Only when computer is running | ✅ 24/7 |
| **Cost** | Free | Free | ~$4-10/month (or free tier) |
| **Requires Computer** | ✅ | ✅ | ❌ |
| **Auto-starts on Boot** | ✅ | ✅ | ✅ |
| **Background Operation** | ✅ | ✅ | ✅ |
| **Best For** | Mac users with always-on computer | Windows users with always-on computer | Anyone who wants reliability |

---

**Questions or issues?** Please open an issue on GitHub!
