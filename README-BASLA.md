# 🚀 Hızlı Başlatma - Yerel Ağ Erişimi

## Tek Komutla Başlat

```bash
./BASLA.sh
```

Bu script:
- ✅ Otomatik IP adresini bulur
- ✅ Frontend'i network erişimi için yapılandırır
- ✅ Backend ve Frontend'i birlikte başlatır

## Manuel Başlatma

Eğer script çalışmazsa:

```bash
# 1. IP'yi öğren
node get-local-ip.js

# 2. Frontend .env'yi güncelle (IP'yi değiştir)
cd frontend
echo "REACT_APP_API_URL=http://192.168.1.250:3001/api" > .env
echo "HOST=0.0.0.0" >> .env
cd ..

# 3. Servisleri başlat
npm run dev
```

## Erişim

Başlatıldıktan sonra:

- **Frontend:** http://192.168.1.250:3000 (IP'niz farklı olabilir)
- **Backend API:** http://192.168.1.250:3001/api

## Giriş Bilgileri

- **Owner:** owner@boatbuild.com / owner123
- **Operation:** kaan@boatbuild.com / operation123

## Diğer Cihazlardan Erişim

Aynı WiFi ağındaki herhangi bir cihazdan (telefon, tablet, başka bilgisayar):

1. Tarayıcıyı aç
2. `http://192.168.1.250:3000` adresine git (IP'yi script çıktısından al)
3. Login ol

## Sorun Giderme

### Backend çalışmıyor
```bash
cd backend
npm run dev
```

### Frontend çalışmıyor
```bash
cd frontend
npm start
```

### Database bağlantı hatası
- PostgreSQL'in çalıştığından emin ol
- `backend/.env` dosyasındaki database bilgilerini kontrol et

### Port zaten kullanımda
```bash
# Port 3000 veya 3001 kullanımda mı kontrol et
lsof -i :3000
lsof -i :3001

# Gerekirse process'i durdur
kill -9 <PID>
```
