#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Alexa to Todoist Sync - Installation Script"
echo "=============================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed.${NC}"
    echo "Please install Node.js from https://nodejs.org/ or using Homebrew:"
    echo "  brew install node"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} npm found: $(npm --version)"
echo ""

# Get the script directory and root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to root directory for npm install
cd "$ROOT_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs
echo -e "${GREEN}✓${NC} Logs directory created"
echo ""

# Check if config.json exists
if [ ! -f config.json ]; then
    echo -e "${YELLOW}⚠️  config.json not found${NC}"
    echo "Copying template..."
    cp shared/config.json.template config.json
    echo ""
    echo "Please configure your credentials:"
    echo ""
    echo "1. Open config.json in a text editor"
    echo "2. Add your Amazon email and password"
    echo "3. Add your Todoist API token and project ID"
    echo ""
    read -p "Press Enter to open config.json in nano (or Ctrl+C to exit and edit manually)..."
    nano config.json
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
echo "🧪 Running test sync (dry run)..."
node shared/sync.js --dry-run

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Test run failed${NC}"
    echo "Please check the error messages above and fix any issues."
    exit 1
fi

echo ""
echo -e "${GREEN}✓${NC} Test run completed"
echo ""

# Ask if user wants to install LaunchDaemon
echo "Would you like to install the LaunchDaemon to run this automatically every 5 minutes?"
echo "(This will run at system boot and requires sudo access)"
read -p "Install LaunchDaemon? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Find the correct node path and username
    NODE_PATH=$(which node)
    CURRENT_USER=$(whoami)

    # Create a temporary plist with correct paths and username
    TEMP_PLIST="/tmp/com.alexassync.plist.tmp"
    cp "$SCRIPT_DIR/com.alexassync.plist" "$TEMP_PLIST"

    # Update plist with correct node path, username, and script directory
    sed -i.bak "s|/path/to/node|$NODE_PATH|g" "$TEMP_PLIST"
    sed -i.bak "s|/path/to/alexa-todoist-sync|$ROOT_DIR|g" "$TEMP_PLIST"
    sed -i.bak "s|<string>YOUR_USERNAME</string>|<string>$CURRENT_USER</string>|g" "$TEMP_PLIST"
    rm "${TEMP_PLIST}.bak"

    # Unload old LaunchAgent if it exists
    launchctl unload ~/Library/LaunchAgents/com.alexassync.plist 2>/dev/null
    
    # Copy plist to LaunchDaemons directory (requires sudo)
    echo "Installing LaunchDaemon (requires sudo)..."
    sudo cp "$TEMP_PLIST" /Library/LaunchDaemons/com.alexassync.plist
    sudo chown root:wheel /Library/LaunchDaemons/com.alexassync.plist
    sudo chmod 644 /Library/LaunchDaemons/com.alexassync.plist

    # Load the LaunchDaemon
    sudo launchctl unload /Library/LaunchDaemons/com.alexassync.plist 2>/dev/null
    sudo launchctl load /Library/LaunchDaemons/com.alexassync.plist

    # Clean up temp file
    rm "$TEMP_PLIST"
    
    # Remove old LaunchAgent plist if it exists
    if [ -f ~/Library/LaunchAgents/com.alexassync.plist ]; then
        rm ~/Library/LaunchAgents/com.alexassync.plist
        echo -e "${GREEN}✓${NC} Removed old LaunchAgent configuration"
    fi

    echo -e "${GREEN}✓${NC} LaunchDaemon installed and loaded"
    echo ""
    echo "The sync will now run automatically every 5 minutes, even after system reboots."
    echo ""
    echo "Useful commands:"
    echo "  • View logs: tail -f $ROOT_DIR/logs/sync.log"
    echo "  • Stop: sudo launchctl unload /Library/LaunchDaemons/com.alexassync.plist"
    echo "  • Start: sudo launchctl load /Library/LaunchDaemons/com.alexassync.plist"
    echo "  • Status: sudo launchctl list | grep alexassync"
    echo "  • Manual run: node shared/sync.js"
else
    echo ""
    echo "LaunchDaemon not installed. You can install it later by running this script again."
    echo ""
    echo "Or run manually with: node shared/sync.js"
fi

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
