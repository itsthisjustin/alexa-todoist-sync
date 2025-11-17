# Alexa to Todoist Sync - Windows Installation Script
# Run this script as Administrator

Write-Host "🚀 Alexa to Todoist Sync - Windows Installation" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "❌ Error: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✓ npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not installed." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Get the current directory (where the script is located)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent $scriptPath

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
Set-Location $rootPath
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Create logs directory
Write-Host "📁 Creating logs directory..." -ForegroundColor Cyan
$logsPath = Join-Path $rootPath "logs"
if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath | Out-Null
}
Write-Host "✓ Logs directory created" -ForegroundColor Green
Write-Host ""

# Check if config.json exists
$configPath = Join-Path $rootPath "config.json"
$configTemplatePath = Join-Path $rootPath "shared\config.json.template"

if (-not (Test-Path $configPath)) {
    Write-Host "⚠️  config.json not found" -ForegroundColor Yellow
    Write-Host "Copying template..." -ForegroundColor Cyan
    Copy-Item $configTemplatePath $configPath
    Write-Host ""
    Write-Host "Please configure your credentials:" -ForegroundColor Yellow
    Write-Host "1. Open config.json in a text editor" -ForegroundColor White
    Write-Host "2. Add your Amazon email and password" -ForegroundColor White
    Write-Host "3. Add your Todoist API token and project ID" -ForegroundColor White
    Write-Host ""

    $response = Read-Host "Open config.json now? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        notepad $configPath
        Write-Host ""
        Write-Host "Press Enter after you've configured your credentials..." -ForegroundColor Yellow
        Read-Host
    } else {
        Write-Host ""
        Write-Host "Please configure config.json manually before continuing." -ForegroundColor Yellow
        exit 0
    }
}

# Verify config has credentials
$config = Get-Content $configPath | ConvertFrom-Json
if ($config.amazon.email -like "*example.com*" -or $config.amazon.password -like "*password*") {
    Write-Host "⚠️  Amazon credentials not configured" -ForegroundColor Yellow
    Write-Host "Please update config.json with your Amazon credentials before continuing." -ForegroundColor Yellow
    exit 0
}

Write-Host "✓ Configuration looks good" -ForegroundColor Green
Write-Host ""

# Test run
Write-Host "🧪 Running test sync (dry run)..." -ForegroundColor Cyan
$syncScriptPath = Join-Path $rootPath "shared\sync.js"
node $syncScriptPath --dry-run

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Test run failed" -ForegroundColor Red
    Write-Host "Please check the error messages above and fix any issues." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✓ Test run completed" -ForegroundColor Green
Write-Host ""

# Ask if user wants to install scheduled task
Write-Host "Would you like to install a Windows Scheduled Task to run this automatically every 5 minutes?" -ForegroundColor Cyan
$response = Read-Host "Install Scheduled Task? (Y/N)"

if ($response -eq "Y" -or $response -eq "y") {
    # Create scheduled task
    $taskName = "AlexaTodoistSync"

    # Remove existing task if it exists
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "Removing existing scheduled task..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    # Get node.exe path
    $nodePath = (Get-Command node).Source

    # Create action
    $action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$syncScriptPath`"" -WorkingDirectory $rootPath

    # Create trigger (every 5 minutes)
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)

    # Create settings
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

    # Create principal (run as current user)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest

    # Register task
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Syncs Alexa Shopping List to Todoist every 5 minutes"

    Write-Host ""
    Write-Host "✓ Scheduled Task installed" -ForegroundColor Green
    Write-Host ""
    Write-Host "The sync will now run automatically every 5 minutes." -ForegroundColor Green
    Write-Host ""
    Write-Host "Useful commands (run in PowerShell as Administrator):" -ForegroundColor Cyan
    Write-Host "  • View task: Get-ScheduledTask -TaskName 'AlexaTodoistSync'" -ForegroundColor White
    Write-Host "  • Disable: Disable-ScheduledTask -TaskName 'AlexaTodoistSync'" -ForegroundColor White
    Write-Host "  • Enable: Enable-ScheduledTask -TaskName 'AlexaTodoistSync'" -ForegroundColor White
    Write-Host "  • Remove: Unregister-ScheduledTask -TaskName 'AlexaTodoistSync'" -ForegroundColor White
    Write-Host "  • Run now: Start-ScheduledTask -TaskName 'AlexaTodoistSync'" -ForegroundColor White
    Write-Host "  • View logs: Get-Content '$logsPath\sync.log' -Tail 50" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Scheduled Task not installed. You can install it later by running this script again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or run manually with: node shared\sync.js" -ForegroundColor White
}

Write-Host ""
Write-Host "🎉 Installation complete!" -ForegroundColor Green
