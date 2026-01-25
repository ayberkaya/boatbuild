#!/bin/bash
# Start backend server for local network access
# Usage: ./start-backend.sh

set -e

echo "🚀 Starting BoatBuild CRM Backend..."
echo ""

cd "$(dirname "$0")/backend"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please edit it with your database credentials."
    else
        echo "❌ .env.example not found!"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Get local IP for display
LOCAL_IP=$(node ../get-local-ip.js 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)

echo "📍 Backend will be accessible at:"
echo "   Local:    http://localhost:3001/api"
if [ ! -z "$LOCAL_IP" ]; then
    echo "   Network: http://${LOCAL_IP}:3001/api"
fi
echo ""
echo "Starting server..."
echo ""

npm run dev
