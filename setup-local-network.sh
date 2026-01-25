#!/bin/bash
# Setup script for local network access
# Usage: ./setup-local-network.sh

set -e

echo "🌐 BoatBuild CRM - Local Network Setup"
echo "========================================"
echo ""

# Get local IP
LOCAL_IP=$(node get-local-ip.js 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not determine local IP address"
    echo "   Run: node get-local-ip.js"
    exit 1
fi

echo "📍 Detected local IP: $LOCAL_IP"
echo ""

# Setup frontend .env
FRONTEND_ENV="frontend/.env"
echo "📝 Configuring frontend..."
cat > "$FRONTEND_ENV" << EOF
# Local Network Configuration
REACT_APP_API_URL=http://${LOCAL_IP}:3001/api
HOST=0.0.0.0
EOF

echo "✅ Frontend configured: $FRONTEND_ENV"
echo "   REACT_APP_API_URL=http://${LOCAL_IP}:3001/api"
echo "   HOST=0.0.0.0"
echo ""

echo "🚀 Ready to start!"
echo ""
echo "   Start servers:"
echo "   npm run dev"
echo ""
echo "   Access from other devices:"
echo "   Frontend: http://${LOCAL_IP}:3000"
echo "   Backend:  http://${LOCAL_IP}:3001/api"
echo ""
echo "⚠️  Make sure firewall allows ports 3000 and 3001"
