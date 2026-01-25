# BoatBuild CRM – Production-Grade Financial Management System

A complete, CRM-first financial management system for boat manufacturing with hak ediş (7% commission) rule engine, role-based access control, and comprehensive dashboards.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Dashboard│ │Expenses │ │Transfers│ │Overrides│ │Documents│   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
└───────┼──────────┼──────────┼──────────┼──────────┼─────────────┘
        │          │          │          │          │
        └──────────┴──────────┴──────────┴──────────┘
                              │
                    ┌─────────▼─────────┐
                    │   REST API (Node)  │
                    │   - Auth           │
                    │   - Hak Ediş Engine│
                    │   - Validation     │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   PostgreSQL DB    │
                    │   - Expenses       │
                    │   - Transfers      │
                    │   - Overrides      │
                    │   - Audit Log      │
                    └───────────────────┘
```

## Core Features

### 1. CRM-First Architecture
- All financial data lives in the CRM
- Excel is backup/audit only, never primary
- Complete audit trail for all actions

### 2. Role-Based Access Control
- **Owner**: Full visibility, approval authority, financial oversight
- **Operation (Kaan)**: Data entry, document upload, cannot modify hak ediş rates

### 3. Hak Ediş Rule Engine (7%)
The commission calculation is rule-engine driven based on operational value:

| Work Scope Level | Description | Hak Ediş Rule |
|-----------------|-------------|---------------|
| PURE_IMALAT | Pure manufacturing labor | Always 7% |
| MALZEME_PLUS_IMALAT | Material + installation | Policy-dependent |
| PURE_MALZEME | Raw materials only | Never eligible |
| NON_IMALAT | Non-manufacturing | Never eligible |

**Policies for MALZEME_PLUS_IMALAT:**
- ALWAYS_INCLUDED → 7% automatic
- ALWAYS_EXCLUDED → Never eligible
- CONDITIONAL → Requires owner approval (default: EXCLUDED)

### 4. Document Requirements
Mandatory documentation for:
- NON_IMALAT expenses
- REKLAM (advertising) expenses  
- Special vendors: BARAN, MOTOR, ETKIN

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file from template
cp .env.example .env
# Edit .env with your database credentials

# Create database
createdb boatbuild_crm

# Run migrations
npm run migrate

# Start server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

### Local Network Access (Testing)

To make the app accessible to other devices on the same WiFi network:

1. **Get your local IP address:**
   ```bash
   node get-local-ip.js
   ```
   This will show your network IP (e.g., `192.168.1.100`)

2. **Backend is already configured** to listen on all interfaces (`0.0.0.0`)

3. **Configure Frontend:**
   ```bash
   cd frontend
   # Create or edit .env file
   cat > .env << EOF
   REACT_APP_API_URL=http://YOUR_IP:3001/api
   HOST=0.0.0.0
   EOF
   # Replace YOUR_IP with the IP from step 1 (e.g., 192.168.1.100)
   ```

4. **Start both servers:**
   ```bash
   # From project root - starts both backend and frontend
   npm run dev
   
   # Or start separately:
   npm run dev:backend   # Terminal 1
   npm run dev:frontend  # Terminal 2
   ```

5. **Access from other devices:**
   - Open browser on any device on the same network
   - Navigate to: `http://YOUR_IP:3000`
   - Backend API will be at: `http://YOUR_IP:3001/api`

**Note:** 
- Make sure your firewall allows connections on ports 3000 and 3001
- On macOS, you may need to allow incoming connections in System Preferences > Security & Privacy > Firewall

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@boatbuild.com | owner123 |
| Operation | kaan@boatbuild.com | operation123 |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense (calculates hak ediş)
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense (Owner only)

### Transfers
- `GET /api/transfers` - List transfers
- `POST /api/transfers` - Create transfer (starts PENDING)
- `POST /api/transfers/:id/approve` - Approve (Owner only)
- `POST /api/transfers/:id/reject` - Reject (Owner only)

### Hak Ediş Overrides
- `GET /api/overrides/pending` - Pending approvals (Owner)
- `POST /api/overrides` - Request override
- `POST /api/overrides/:id/approve` - Approve (Owner)
- `POST /api/overrides/:id/reject` - Reject (Owner)

### Dashboard
- `GET /api/dashboard/kpis` - Key performance indicators
- `GET /api/dashboard/summary` - Full dashboard data
- `GET /api/dashboard/alerts` - Active alerts

## Dashboard Features

### Owner Dashboard Shows:
1. **KPI Cards**
   - Total Spend
   - Paid Hak Ediş
   - Remaining Potential
   - Conditional Risk Exposure

2. **Charts**
   - Bar chart: Hak edişli vs Hak edişsiz expenses
   - Line chart: Monthly hak ediş trend

3. **Tables**
   - Realized hak ediş by category
   - Future projection (Cam, Parke, Boya, etc.)

4. **Alerts**
   - Missing documents
   - Conditional items pending approval
   - Expenses without linked transfers
   - Unusual hak ediş rate increases

## Non-Negotiable Rules

1. **Never auto-include hak ediş for CONDITIONAL items**
2. **Never allow saving expense without primary_tag and work_scope_level**
3. **Never allow Operation user to change hak ediş rate**
4. **Never hide financial data from Owner**
5. **Never assume Excel is correct over CRM**

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql      # Database schema
│   │   │   ├── connection.js   # DB connection pool
│   │   │   └── migrate.js      # Migration script
│   │   ├── engine/
│   │   │   └── hakEdisEngine.js # Rule engine
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── expenses.js
│   │   │   ├── transfers.js
│   │   │   ├── overrides.js
│   │   │   ├── documents.js
│   │   │   ├── vendors.js
│   │   │   └── dashboard.js
│   │   └── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js       # Axios API client
│   │   ├── components/
│   │   │   └── Layout.js       # Main layout
│   │   ├── contexts/
│   │   │   └── AuthContext.js  # Auth state
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Expenses.js
│   │   │   ├── ExpenseForm.js
│   │   │   ├── Transfers.js
│   │   │   ├── TransferForm.js
│   │   │   ├── Overrides.js
│   │   │   ├── Vendors.js
│   │   │   └── Documents.js
│   │   ├── App.js
│   │   └── index.js
│   ├── tailwind.config.js
│   └── package.json
│
└── docs/
    ├── 01_system_overview.md
    └── 02_hak_edis_rule_engine.md
```

## UI Color System

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | #0A2540 | Navy - Main actions, headers |
| Secondary | #00B4D8 | Cyan - Accents, highlights |
| Success | #2ECC71 | Green - Approvals, positive |
| Warning | #F1C40F | Yellow - Pending, attention |
| Danger | #E74C3C | Red - Errors, rejections |
| Background | #F8F9FA | Light gray - Page background |
| Text | #1C1C1C | Dark - Body text |

## Security Notes

- JWT-based authentication with 24h expiry
- Role-based access control on all endpoints
- Audit logging for all data modifications
- Owner-only routes for approvals and deletions
- Input validation on all forms

## Extending the System

The hak ediş engine is designed for extensibility:

1. **Add new expense categories** - Insert into `expense_categories` table
2. **Add new work scope levels** - Update ENUM and engine logic
3. **Add new policies** - Extend the `calculateHakEdis` function
4. **Add new alerts** - Insert into `alerts` table with appropriate severity

## License

Private - BoatBuild Manufacturing
