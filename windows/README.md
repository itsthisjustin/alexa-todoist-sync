# Alexa to Todoist Sync - Windows

Automatically syncs items from your Alexa Shopping List to Todoist on Windows.

## Prerequisites

- Windows 10 or higher
- Node.js 18 or higher ([Download here](https://nodejs.org/))
- PowerShell 5.1 or higher (included with Windows 10+)
- Amazon account with Alexa Shopping List
- Todoist account with API access

## Quick Installation

1. **Clone or download this repository**

2. **Open PowerShell as Administrator:**
   - Press `Win + X`
   - Click "Windows PowerShell (Admin)" or "Terminal (Admin)"

3. **Navigate to the windows directory:**
   ```powershell
   cd path\to\alexa-todoist-sync\windows
   ```

4. **Allow script execution (if needed):**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

5. **Run the install script:**
   ```powershell
   .\install.ps1
   ```

6. **Follow the prompts** to configure your credentials and install the Scheduled Task

## Manual Installation

1. **Install dependencies:**
   ```powershell
   npm install
   ```

2. **Configure credentials:**
   - Copy `shared\config.json.template` to `config.json` in the root directory
   - Fill in your Amazon and Todoist credentials

3. **Test the sync:**
   ```powershell
   node shared\sync.js --dry-run
   ```

4. **Create Scheduled Task manually:**
   - Open Task Scheduler (`taskschd.msc`)
   - Create a new task that runs `node.exe` with argument `"path\to\shared\sync.js"`
   - Set trigger to repeat every 5 minutes
   - Configure to run whether user is logged on or not

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

### Automatic Sync (Scheduled Task)

Once installed, the sync runs automatically every 5 minutes. No action needed!

### Manual Sync

Run a one-time sync:
```powershell
node shared\sync.js
```

### Dry Run (Test Mode)

Test without actually syncing:
```powershell
node shared\sync.js --dry-run
```

### View Logs

```powershell
# View last 50 lines of sync log
Get-Content logs\sync.log -Tail 50

# Follow live logs (requires PowerShell 3.0+)
Get-Content logs\sync.log -Wait -Tail 50

# View error logs
Get-Content logs\sync-error.log -Tail 50
```

## Managing the Scheduled Task

All commands should be run in PowerShell as Administrator.

### View task status:
```powershell
Get-ScheduledTask -TaskName "AlexaTodoistSync"
```

### Disable automatic syncing:
```powershell
Disable-ScheduledTask -TaskName "AlexaTodoistSync"
```

### Enable automatic syncing:
```powershell
Enable-ScheduledTask -TaskName "AlexaTodoistSync"
```

### Run now:
```powershell
Start-ScheduledTask -TaskName "AlexaTodoistSync"
```

### View last run result:
```powershell
Get-ScheduledTaskInfo -TaskName "AlexaTodoistSync"
```

### Uninstall:
```powershell
Unregister-ScheduledTask -TaskName "AlexaTodoistSync" -Confirm:$false
```

## Troubleshooting

### "Execution Policy" Error

If you see an error about execution policy:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Login required" every time

Your cookies might be expiring. Try:
1. Delete `cookies.json`
2. Run `node shared\sync.js` to login fresh
3. Check if Amazon is asking for verification

### Items not syncing

1. Check logs: `Get-Content logs\sync.log -Tail 50`
2. Run in dry-run mode: `node shared\sync.js --dry-run`
3. Verify your Todoist API token and project ID
4. Make sure you have items in your Alexa Shopping List

### Scheduled Task not running

Check the task status:
```powershell
Get-ScheduledTask -TaskName "AlexaTodoistSync"
Get-ScheduledTaskInfo -TaskName "AlexaTodoistSync"
```

Check Windows Event Viewer:
1. Open Event Viewer (`eventvwr.msc`)
2. Navigate to: Windows Logs → Application
3. Look for events from "Task Scheduler"

### Puppeteer Issues on Windows

If Puppeteer fails to download Chrome:
```powershell
# Set environment variable before npm install
$env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "false"
npm install puppeteer --force
```

## Security Notes

- Your credentials are stored locally in `config.json`
- Cookies are stored locally in `cookies.json`
- Never commit these files to version control
- The `.gitignore` file protects against accidental commits
- The Scheduled Task runs with your user credentials

## How It Works

1. **Alexa → Todoist**: Every 5 minutes, new items from your Alexa Shopping List are synced to Todoist
2. **Todoist → Alexa**: Once per day (configurable), completed Todoist tasks are marked complete on Alexa
3. **Smart tracking**: Items you re-add to Alexa after completing them will sync again

## Running as a Windows Service (Advanced)

For advanced users who want the sync to run even when logged out, you can use [NSSM](https://nssm.cc/) to create a proper Windows service:

1. Download NSSM
2. Run: `nssm install AlexaTodoistSync`
3. Configure to run `node.exe` with your sync script
4. Set up service recovery options

## Support

For issues and questions, please open an issue on GitHub.
