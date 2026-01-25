#!/bin/bash
# Start both backend and frontend for local network access
# Usage: ./start-network.sh

set -e

cd "$(dirname "$0")"

echo "🌐 BoatBuild CRM - Local Network Setup"
echo "========================================"
echo ""

# Get local IP
LOCAL_IP=$(node get-local-ip.js 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not determine local IP address"
    exit 1
fi

echo "📍 Local IP: $LOCAL_IP"
echo ""

# Setup frontend .env
echo "📝 Configuring frontend..."
cat > frontend/.env << EOF
# Local Network Configuration
REACT_APP_API_URL=http://${LOCAL_IP}:3001/api
HOST=0.0.0.0
EOF
echo "✅ Frontend configured"
echo ""

# Check if backend .env exists
if [ ! -f backend/.env ]; then
    echo "⚠️  Backend .env not found. Creating from template..."
    if [ -f backend/.env.example ]; then
        cp backend/.env.example backend/.env
        echo "✅ Created backend/.env"
        echo "⚠️  Please edit backend/.env with your database credentials!"
        echo ""
    fi
fi

# Check if node_modules exist
if [ ! -d backend/node_modules ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d frontend/node_modules ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "🚀 Starting servers..."
echo ""
echo "📍 Access URLs:"
echo "   Frontend: http://${LOCAL_IP}:3000"
echo "   Backend:  http://${LOCAL_IP}:3001/api"
echo ""
echo "📋 Login credentials:"
echo "   Owner: owner@boatbuild.com / owner123"
echo "   Operation: kaan@boatbuild.com / operation123"
echo ""
echo "⚠️  Make sure PostgreSQL is running!"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Start both servers
echo "Starting backend and frontend..."
npm run dev
