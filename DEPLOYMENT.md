# Deployment Guide - BoatBuild CRM

Bu doküman sistemi production'a geçirmek için adımları içerir.

## Deployment Seçenekleri

### 1. Railway (Önerilen - En Kolay)

Railway hem database, hem backend, hem frontend'i destekler.

#### Adımlar:

1. **Railway hesabı oluştur:**
   - https://railway.app adresine git
   - GitHub ile giriş yap

2. **Yeni proje oluştur:**
   - "New Project" → "Deploy from GitHub repo"
   - Repository'yi seç

3. **PostgreSQL Database ekle:**
   - "New" → "Database" → "PostgreSQL"
   - Database otomatik oluşturulur

4. **Backend Service ekle:**
   - "New" → "GitHub Repo" → Repository'yi seç
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables ekle:
     ```
     NODE_ENV=production
     PORT=3001
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     DB_HOST=${{Postgres.PGHOST}}
     DB_PORT=${{Postgres.PGPORT}}
     DB_NAME=${{Postgres.PGDATABASE}}
     DB_USER=${{Postgres.PGUSER}}
     DB_PASSWORD=${{Postgres.PGPASSWORD}}
     JWT_SECRET=<güçlü-random-string>
     JWT_EXPIRES_IN=24h
     UPLOAD_DIR=/tmp/uploads
     MAX_FILE_SIZE=10485760
     CORS_ORIGIN=https://your-frontend-domain.com
     ```

5. **Frontend Service ekle:**
   - "New" → "GitHub Repo" → Repository'yi seç
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Start command: `npx serve -s build -l 3000`
   - Environment variables:
     ```
     REACT_APP_API_URL=https://your-backend-domain.railway.app/api
     ```

6. **Migration çalıştır:**
   - Backend service'de "Deployments" → "View Logs"
   - Terminal'de: `railway run cd backend && npm run migrate`

7. **Domain ekle:**
   - Her service için "Settings" → "Generate Domain" veya custom domain ekle

---

### 2. Render

Render da benzer şekilde çalışır.

#### Adımlar:

1. **Render hesabı oluştur:**
   - https://render.com adresine git
   - GitHub ile giriş yap

2. **render.yaml kullan:**
   - Repository'de `render.yaml` dosyası var
   - "New" → "Blueprint" → Repository'yi seç
   - Render otomatik olarak tüm servisleri oluşturur

3. **Environment variables:**
   - Render dashboard'dan her service için env vars ekle
   - `CORS_ORIGIN`: Frontend URL'i
   - `REACT_APP_API_URL`: Backend URL'i

4. **Migration:**
   - Backend service'de "Shell" aç
   - `cd backend && npm run migrate`

---

### 3. VPS (DigitalOcean, AWS EC2, etc.)

Daha fazla kontrol için VPS kullanılabilir.

#### Gereksinimler:
- Ubuntu 20.04+ server
- Node.js 18+
- PostgreSQL 14+
- Nginx (reverse proxy için)

#### Adımlar:

1. **Server setup:**
   ```bash
   # Node.js kurulumu
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # PostgreSQL kurulumu
   sudo apt-get install postgresql postgresql-contrib
   
   # Nginx kurulumu
   sudo apt-get install nginx
   ```

2. **Database oluştur:**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE boatbuild_crm;
   CREATE USER boatbuild_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE boatbuild_crm TO boatbuild_user;
   ```

3. **Backend deploy:**
   ```bash
   cd /var/www
   git clone <repo-url> boatbuild-crm
   cd boatbuild-crm/backend
   npm install --production
   cp .env.example .env
   # .env dosyasını düzenle
   npm run migrate
   ```

4. **PM2 ile backend çalıştır:**
   ```bash
   sudo npm install -g pm2
   cd /var/www/boatbuild-crm/backend
   pm2 start src/server.js --name boatbuild-backend
   pm2 save
   pm2 startup
   ```

5. **Frontend build:**
   ```bash
   cd /var/www/boatbuild-crm/frontend
   npm install
   npm run build
   ```

6. **Nginx configuration:**
   ```nginx
   # /etc/nginx/sites-available/boatbuild
   server {
       listen 80;
       server_name your-domain.com;
       
       # Frontend
       location / {
           root /var/www/boatbuild-crm/frontend/build;
           try_files $uri $uri/ /index.html;
       }
       
       # Backend API
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## Post-Deployment Checklist

- [ ] Database migration çalıştırıldı
- [ ] Default users oluşturuldu (owner@boatbuild.com, kaan@boatbuild.com)
- [ ] Environment variables doğru ayarlandı
- [ ] CORS_ORIGIN frontend URL'ine ayarlandı
- [ ] REACT_APP_API_URL backend URL'ine ayarlandı
- [ ] SSL/HTTPS aktif (Let's Encrypt veya platform SSL)
- [ ] File upload dizini yazılabilir
- [ ] Backup stratejisi belirlendi

## Environment Variables

### Backend (.env)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DB_HOST=host
DB_PORT=5432
DB_NAME=boatbuild_crm
DB_USER=user
DB_PASSWORD=password
JWT_SECRET=<güçlü-random-string>
JWT_EXPIRES_IN=24h
UPLOAD_DIR=/tmp/uploads
MAX_FILE_SIZE=10485760
CORS_ORIGIN=https://your-frontend-domain.com
```

### Frontend (.env)
```
REACT_APP_API_URL=https://your-backend-domain.com/api
```

## Troubleshooting

### Database bağlantı hatası:
- DATABASE_URL veya DB_* değişkenlerini kontrol et
- Database'in public erişime açık olduğundan emin ol

### CORS hatası:
- CORS_ORIGIN'in frontend URL'i ile eşleştiğinden emin ol
- Protocol (http/https) uyumlu olmalı

### File upload hatası:
- UPLOAD_DIR dizininin yazılabilir olduğundan emin ol
- Production'da /tmp/uploads veya cloud storage (S3) kullan

## Monitoring

- Backend logs: Railway/Render dashboard veya `pm2 logs`
- Database: Platform dashboard veya `pg_stat_activity`
- Uptime: UptimeRobot veya benzer servis
