#!/bin/bash
# Basit başlatma scripti - Yerel ağ erişimi için
# Kullanım: ./BASLA.sh

cd "$(dirname "$0")"

echo "🚀 BoatBuild CRM Başlatılıyor..."
echo ""

# IP'yi al
LOCAL_IP=$(node get-local-ip.js 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)

if [ -z "$LOCAL_IP" ]; then
    echo "❌ IP adresi bulunamadı"
    exit 1
fi

# Frontend .env'yi güncelle
cat > frontend/.env << EOF
REACT_APP_API_URL=http://${LOCAL_IP}:3001/api
HOST=0.0.0.0
EOF

echo "✅ Yapılandırma tamamlandı"
echo ""
echo "📍 Erişim adresleri:"
echo "   Frontend: http://${LOCAL_IP}:3000"
echo "   Backend:  http://${LOCAL_IP}:3001/api"
echo ""
echo "🔑 Giriş bilgileri:"
echo "   Owner: owner@boatbuild.com / owner123"
echo "   Operation: kaan@boatbuild.com / operation123"
echo ""
echo "⏳ Servisler başlatılıyor..."
echo ""

# Servisleri başlat
npm run dev
