# Alexa to Todoist Sync - Cloud / EC2

Run the Alexa to Todoist sync on a cloud server (AWS EC2, DigitalOcean, etc.) for 24/7 operation without keeping your personal computer running.

## Why Run in the Cloud?

- ✅ Always-on: Runs 24/7 without your computer
- ✅ Reliable: Auto-restarts on failure with systemd
- ✅ Cost-effective: Can run on free-tier EC2 instances
- ✅ Headless: Optimized for server environments

## Prerequisites

- Linux server (Ubuntu, Debian, Amazon Linux, RHEL, or CentOS)
- SSH access to the server
- Sudo/root privileges
- Amazon account with Alexa Shopping List
- Todoist account with API access

## Supported Platforms

- **Ubuntu** 18.04, 20.04, 22.04, 24.04
- **Debian** 10, 11, 12
- **Amazon Linux** 2, 2023
- **RHEL/CentOS** 7, 8, 9

## Quick Installation on AWS EC2

### 1. Launch an EC2 Instance

**Recommended specs:**
- **Instance type:** t2.micro or t3.micro (free tier eligible)
- **AMI:** Ubuntu Server 22.04 LTS or Amazon Linux 2023
- **Storage:** 8 GB (default is fine)
- **Security Group:** Outbound traffic only (no inbound rules needed)

**Launch instance:**
```bash
# Using AWS CLI (optional)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t2.micro \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=alexa-todoist-sync}]'
```

### 2. Connect to Your Instance

```bash
ssh -i your-key.pem ubuntu@your-instance-ip
# or for Amazon Linux:
ssh -i your-key.pem ec2-user@your-instance-ip
```

### 3. Clone the Repository

```bash
sudo apt update  # or: sudo yum update
sudo apt install -y git  # or: sudo yum install -y git

git clone https://github.com/YOUR_USERNAME/alexa-todoist-sync.git
cd alexa-todoist-sync
```

### 4. Run the Installation Script

```bash
cd cloud
sudo ./install.sh
```

The script will:
- Install Node.js if not present
- Install Chrome/Chromium for Puppeteer
- Install npm dependencies
- Help you configure credentials
- Run a test sync
- Install and start a systemd service

### 5. Configure Credentials

When prompted, edit `config.json`:
```bash
nano config.json
```

Add your credentials:
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

**Important:** Make sure `headless` is set to `true` for cloud environments.

## Installation on Other Cloud Providers

### DigitalOcean

1. Create a Droplet (Ubuntu 22.04, Basic plan, $4-6/month)
2. SSH into your droplet
3. Follow steps 3-5 above

### Google Cloud Platform (GCP)

1. Create a Compute Engine instance (e2-micro for free tier)
2. SSH via browser or gcloud CLI
3. Follow steps 3-5 above

### Azure

1. Create a Virtual Machine (B1s for ~$10/month)
2. SSH into your VM
3. Follow steps 3-5 above

### Any Linux Server

Works on any Linux server with:
- Ubuntu/Debian/RHEL/CentOS/Amazon Linux
- Internet connection
- Systemd (most modern distros)

## Configuration

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

### Automatic Sync (systemd)

Once installed, the sync runs automatically every 5 minutes via systemd timer. No action needed!

### Manual Sync

Run a one-time sync:
```bash
cd /path/to/alexa-todoist-sync
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

# View last 50 lines
tail -50 logs/sync.log

# View error logs
tail -f logs/sync-error.log
```

## Managing the Systemd Service

### Check status:
```bash
sudo systemctl status alexa-todoist-sync.timer
sudo systemctl status alexa-todoist-sync.service
```

### Stop automatic syncing:
```bash
sudo systemctl stop alexa-todoist-sync.timer
```

### Start automatic syncing:
```bash
sudo systemctl start alexa-todoist-sync.timer
```

### Disable (won't start on boot):
```bash
sudo systemctl disable alexa-todoist-sync.timer
```

### Enable (start on boot):
```bash
sudo systemctl enable alexa-todoist-sync.timer
```

### Run sync now:
```bash
sudo systemctl start alexa-todoist-sync.service
```

### View timer schedule:
```bash
systemctl list-timers alexa-todoist-sync.timer
```

### View service logs:
```bash
# View systemd logs
sudo journalctl -u alexa-todoist-sync.service -f

# View application logs
tail -f logs/sync.log
```

## Troubleshooting

### Puppeteer Chrome Download Issues

If Puppeteer fails to download Chrome:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y chromium-browser

# Amazon Linux
sudo amazon-linux-extras install epel -y
sudo yum install -y chromium
```

### "Login required" every time

Your cookies might be expiring. Try:
1. Delete `cookies.json`
2. Run `node shared/sync.js` to login fresh
3. Check if Amazon is requiring additional verification

For cloud environments, you might need to:
- Run once with `"headless": false` on a local machine to complete 2FA
- Copy `cookies.json` to the server
- Set `"headless": true` again

### Items not syncing

1. Check logs: `tail -f logs/sync.log`
2. Check systemd status: `sudo systemctl status alexa-todoist-sync.service`
3. Run in dry-run mode: `node shared/sync.js --dry-run`
4. Verify your Todoist API token and project ID

### Service not running

Check the timer status:
```bash
systemctl list-timers alexa-todoist-sync.timer
```

Check the service status:
```bash
sudo systemctl status alexa-todoist-sync.service
```

Restart the timer:
```bash
sudo systemctl restart alexa-todoist-sync.timer
```

### Memory issues on small instances

If you're running on a very small instance (512MB RAM), you might need to:

1. Add swap space:
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

2. Ensure headless mode is enabled in `config.json`

## Cost Estimates

### AWS EC2 Free Tier
- **t2.micro:** FREE for 12 months (750 hours/month)
- **After free tier:** ~$8-10/month

### DigitalOcean
- **Basic Droplet:** $4-6/month

### Google Cloud Platform
- **e2-micro:** FREE with free tier credits
- **After free tier:** ~$7/month

### Oracle Cloud (Best Free Option)
- **Always Free tier:** FREE forever (ARM-based instances)

## Security Best Practices

### Protect Your Credentials

1. **Set proper file permissions:**
```bash
chmod 600 config.json
chmod 600 cookies.json
```

2. **Never commit credentials to git:**
```bash
# Already in .gitignore, but verify:
cat .gitignore | grep config.json
```

3. **Use environment variables (optional):**
```bash
# Set in systemd service file instead of config.json
Environment="AMAZON_EMAIL=your-email@example.com"
Environment="AMAZON_PASSWORD=your-password"
```

### Secure Your Server

1. **Use SSH keys** (not passwords)
2. **Enable firewall:**
```bash
sudo ufw enable
sudo ufw allow ssh
```

3. **Keep system updated:**
```bash
sudo apt update && sudo apt upgrade -y
# or
sudo yum update -y
```

4. **Consider using AWS Secrets Manager** or similar for credentials

## Updating

To update to the latest version:

```bash
cd /path/to/alexa-todoist-sync
git pull
npm install
sudo systemctl restart alexa-todoist-sync.service
```

## Uninstalling

```bash
# Stop and disable the service
sudo systemctl stop alexa-todoist-sync.timer
sudo systemctl disable alexa-todoist-sync.timer
sudo systemctl stop alexa-todoist-sync.service
sudo systemctl disable alexa-todoist-sync.service

# Remove systemd files
sudo rm /etc/systemd/system/alexa-todoist-sync.service
sudo rm /etc/systemd/system/alexa-todoist-sync.timer
sudo systemctl daemon-reload

# Remove the application
cd ..
rm -rf alexa-todoist-sync
```

## Monitoring

### Set up email alerts (optional)

Install and configure `sendmail` or use a monitoring service:

```bash
# Simple uptime monitoring
sudo apt-get install -y monitoring-plugins
```

### CloudWatch (AWS)

If on EC2, you can send logs to CloudWatch:
```bash
sudo yum install -y amazon-cloudwatch-agent
# Configure to send logs/sync.log to CloudWatch
```

## Support

For issues and questions, please open an issue on GitHub.
