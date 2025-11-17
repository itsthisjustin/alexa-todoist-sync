# Alexa to Todoist Sync - macOS

Automatically syncs items from your Alexa Shopping List to Todoist on your Mac.

## Prerequisites

- macOS 10.13 or higher
- Node.js 18 or higher ([Download here](https://nodejs.org/))
- Amazon account with Alexa Shopping List
- Todoist account with API access

## Quick Installation

1. **Clone or download this repository**

2. **Run the install script:**
   ```bash
   cd mac
   chmod +x install.sh
   ./install.sh
   ```

3. **Follow the prompts** to configure your credentials and install the LaunchDaemon

## Manual Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure credentials:**
   - Copy `shared/config.json.template` to `config.json` in the root directory
   - Fill in your Amazon and Todoist credentials

3. **Test the sync:**
   ```bash
   node shared/sync.js --dry-run
   ```

4. **Install LaunchDaemon (optional):**
   ```bash
   # Update paths in com.alexassync.plist first!
   sudo cp mac/com.alexassync.plist /Library/LaunchDaemons/
   sudo chown root:wheel /Library/LaunchDaemons/com.alexassync.plist
   sudo chmod 644 /Library/LaunchDaemons/com.alexassync.plist
   sudo launchctl load /Library/LaunchDaemons/com.alexassync.plist
   ```

## Configuration

Edit `config.json` in the root directory:

```json
{
  "amazon": {
    "email": "your-email@example.com",
    "password": "your-password"
  },
  "todoist": {
    "apiToken": "your-api-token",
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

### Getting Your Todoist API Token

1. Go to [Todoist Settings → Integrations](https://todoist.com/prefs/integrations)
2. Scroll to "API token" section
3. Copy your API token

### Getting Your Todoist Project ID

1. Open Todoist in your browser
2. Click on the project you want to use
3. Look at the URL: `https://todoist.com/app/project/2275365528`
4. The number at the end is your project ID

## Usage

### Automatic Sync (LaunchDaemon)

Once installed, the sync runs automatically every 5 minutes. No action needed!

### Manual Sync

Run a one-time sync:
```bash
node shared/sync.js
```

### Dry Run (Test Mode)

Test without actually syncing:
```bash
node shared/sync.js --dry-run
```

### View Logs

```bash
# Follow live logs
tail -f logs/sync.log

# View error logs
tail -f logs/sync-error.log
```

## Managing the LaunchDaemon

### Stop automatic syncing:
```bash
sudo launchctl unload /Library/LaunchDaemons/com.alexassync.plist
```

### Start automatic syncing:
```bash
sudo launchctl load /Library/LaunchDaemons/com.alexassync.plist
```

### Check if running:
```bash
sudo launchctl list | grep alexassync
```

### Uninstall:
```bash
sudo launchctl unload /Library/LaunchDaemons/com.alexassync.plist
sudo rm /Library/LaunchDaemons/com.alexassync.plist
```

## Troubleshooting

### "Login required" every time

Your cookies might be expiring. Try:
1. Delete `cookies.json`
2. Run `node shared/sync.js` to login fresh
3. Check if Amazon is asking for verification

### Items not syncing

1. Check logs: `tail -f logs/sync.log`
2. Run in dry-run mode: `node shared/sync.js --dry-run`
3. Verify your Todoist API token and project ID
4. Make sure you have items in your Alexa Shopping List

### LaunchDaemon not running

Check if it's loaded and active:
```bash
sudo launchctl list | grep alexassync
```

Manually restart:
```bash
sudo launchctl unload /Library/LaunchDaemons/com.alexassync.plist
sudo launchctl load /Library/LaunchDaemons/com.alexassync.plist
```

## Security Notes

- Your credentials are stored locally in `config.json`
- Cookies are stored locally in `cookies.json`
- Never commit these files to version control
- The `.gitignore` file protects against accidental commits

## How It Works

1. **Alexa → Todoist**: Every 5 minutes, new items from your Alexa Shopping List are synced to Todoist
2. **Todoist → Alexa**: Once per day (configurable), completed Todoist tasks are marked complete on Alexa
3. **Smart tracking**: Items you re-add to Alexa after completing them will sync again

## Support

For issues and questions, please open an issue on GitHub.
