#!/bin/bash

# Alexa to Todoist Sync - Cloud/EC2 Installation Script
# Supports Ubuntu/Debian and Amazon Linux

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Alexa to Todoist Sync - Cloud/EC2 Installation${NC}"
echo "=================================================="
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo -e "${RED}❌ Cannot detect operating system${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Detected OS: $OS"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ This script must be run as root or with sudo${NC}"
    exit 1
fi

# Get the actual user (not root if using sudo)
ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)

echo -e "${GREEN}✓${NC} Running as root (will install for user: $ACTUAL_USER)"
echo ""

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js not found. Installing...${NC}"

    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        # Install Node.js 18.x on Ubuntu/Debian
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif [[ "$OS" == *"Amazon"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"CentOS"* ]]; then
        # Install Node.js on Amazon Linux/RHEL/CentOS
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    else
        echo -e "${RED}❌ Unsupported OS. Please install Node.js 18+ manually.${NC}"
        exit 1
    fi

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install Node.js${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Node.js found: $(node --version)"
echo -e "${GREEN}✓${NC} npm found: $(npm --version)"
echo ""

# Install Chrome/Chromium for Puppeteer (headless mode)
echo -e "${CYAN}📦 Installing Chrome/Chromium for Puppeteer...${NC}"

if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    apt-get update
    apt-get install -y chromium-browser chromium-chromedriver
elif [[ "$OS" == *"Amazon"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"CentOS"* ]]; then
    # Install Chromium dependencies for Amazon Linux
    amazon-linux-extras install epel -y
    yum install -y chromium
fi

echo -e "${GREEN}✓${NC} Chrome/Chromium installed"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to root directory
cd "$ROOT_DIR"

# Install npm dependencies
echo -e "${CYAN}📦 Installing npm dependencies...${NC}"
sudo -u $ACTUAL_USER npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Create logs directory
echo -e "${CYAN}📁 Creating logs directory...${NC}"
mkdir -p logs
chown $ACTUAL_USER:$ACTUAL_USER logs
echo -e "${GREEN}✓${NC} Logs directory created"
echo ""

# Check if config.json exists
if [ ! -f config.json ]; then
    echo -e "${YELLOW}⚠️  config.json not found${NC}"
    echo "Copying template..."
    sudo -u $ACTUAL_USER cp shared/config.json.template config.json
    chown $ACTUAL_USER:$ACTUAL_USER config.json
    echo ""
    echo -e "${YELLOW}Please configure your credentials:${NC}"
    echo "1. Edit config.json"
    echo "2. Add your Amazon email and password"
    echo "3. Add your Todoist API token and project ID"
    echo ""
    echo "Command: nano config.json"
    echo ""
    read -p "Press Enter to open config.json in nano (or Ctrl+C to exit and edit manually)..."
    sudo -u $ACTUAL_USER nano config.json
fi

# Verify config.json has credentials
if grep -q "your-amazon-email@example.com" config.json || grep -q "your-amazon-password" config.json; then
    echo -e "${YELLOW}⚠️  Amazon credentials not configured${NC}"
    echo "Please update config.json with your Amazon credentials before continuing."
    exit 0
fi

echo -e "${GREEN}✓${NC} Configuration looks good"
echo ""

# Test run
echo -e "${CYAN}🧪 Running test sync (dry run)...${NC}"
sudo -u $ACTUAL_USER node shared/sync.js --dry-run

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Test run failed${NC}"
    echo "Please check the error messages above and fix any issues."
    exit 1
fi

echo ""
echo -e "${GREEN}✓${NC} Test run completed"
echo ""

# Ask if user wants to install systemd service
echo "Would you like to install a systemd service to run this automatically every 5 minutes?"
echo "(This will run at system boot and restart on failure)"
read -p "Install systemd service? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Find the correct node path
    NODE_PATH=$(which node)

    # Create systemd service file
    SERVICE_FILE="/etc/systemd/system/alexa-todoist-sync.service"

    echo -e "${CYAN}Creating systemd service...${NC}"

    cat > $SERVICE_FILE << EOF
[Unit]
Description=Alexa to Todoist Sync Service
After=network.target

[Service]
Type=oneshot
User=$ACTUAL_USER
WorkingDirectory=$ROOT_DIR
ExecStart=$NODE_PATH $ROOT_DIR/shared/sync.js
StandardOutput=append:$ROOT_DIR/logs/sync.log
StandardError=append:$ROOT_DIR/logs/sync-error.log

[Install]
WantedBy=multi-user.target
EOF

    # Create systemd timer file
    TIMER_FILE="/etc/systemd/system/alexa-todoist-sync.timer"

    cat > $TIMER_FILE << EOF
[Unit]
Description=Run Alexa to Todoist Sync every 5 minutes
Requires=alexa-todoist-sync.service

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Unit=alexa-todoist-sync.service

[Install]
WantedBy=timers.target
EOF

    # Reload systemd and enable the timer
    systemctl daemon-reload
    systemctl enable alexa-todoist-sync.timer
    systemctl start alexa-todoist-sync.timer

    echo ""
    echo -e "${GREEN}✓${NC} Systemd service and timer installed"
    echo ""
    echo "The sync will now run automatically every 5 minutes, even after system reboots."
    echo ""
    echo "Useful commands:"
    echo "  • View status: sudo systemctl status alexa-todoist-sync.timer"
    echo "  • Stop: sudo systemctl stop alexa-todoist-sync.timer"
    echo "  • Start: sudo systemctl start alexa-todoist-sync.timer"
    echo "  • Disable: sudo systemctl disable alexa-todoist-sync.timer"
    echo "  • View logs: tail -f $ROOT_DIR/logs/sync.log"
    echo "  • Run now: sudo systemctl start alexa-todoist-sync.service"
    echo "  • View timer schedule: systemctl list-timers alexa-todoist-sync.timer"
else
    echo ""
    echo "Systemd service not installed. You can install it later by running this script again."
    echo ""
    echo "Or run manually with: node shared/sync.js"
fi

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
