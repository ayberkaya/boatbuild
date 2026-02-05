/**
 * BoatBuild CRM Server
 * Production-grade CRM-first financial system for boat manufacturing
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const transferRoutes = require('./routes/transfers');
const overrideRoutes = require('./routes/overrides');
const documentRoutes = require('./routes/documents');
const vendorRoutes = require('./routes/vendors');
const dashboardRoutes = require('./routes/dashboard');
const futureExpensesRoutes = require('./routes/futureExpenses');
const dataExportImportRoutes = require('./routes/dataExportImport');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS: Allow localhost and local network IPs in development
const corsOrigin = process.env.CORS_ORIGIN;
const allowedOrigins = corsOrigin
    ? corsOrigin.split(',').map(o => o.trim())
    : process.env.NODE_ENV === 'production'
        ? ['http://localhost:3000']
        : [
            'http://localhost:3000',
            /^http:\/\/192\.168\.\d+\.\d+:\d+$/,  // 192.168.x.x:port
            /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,   // 10.x.x.x:port
            /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/  // 172.16-31.x.x:port
        ];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if origin matches allowed patterns
        const isAllowed = allowedOrigins.some(allowed => {
            if (typeof allowed === 'string') {
                return origin === allowed;
            }
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return false;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn('[CORS] Blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/overrides', overrideRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/future-expenses', futureExpensesRoutes);
app.use('/api/data', dataExportImportRoutes);

// Serve uploaded files (protected)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);

    // Multer file size error
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            error: 'File too large',
            max_size: process.env.MAX_FILE_SIZE || '10MB'
        });
    }

    // Multer file type error
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Get local network IP for display
const os = require('os');
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
};

const HOST = process.env.HOST || '0.0.0.0';
const localIP = getLocalIP();

// Start server
app.listen(PORT, HOST, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    BoatBuild CRM Server                       ║
║                                                              ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(43)}║
║  Port: ${PORT.toString().padEnd(51)}║
║  Local: http://localhost:${PORT}/api                          ║
║  Network: http://${localIP}:${PORT}/api${' '.repeat(Math.max(0, 30 - localIP.length - PORT.toString().length))}║
║                                                              ║
║  Endpoints:                                                  ║
║  - /api/auth       Authentication                            ║
║  - /api/expenses   Expense management                        ║
║  - /api/transfers  Transfer management                       ║
║  - /api/overrides  Hak ediş overrides                        ║
║  - /api/documents  Document management                       ║
║  - /api/vendors    Vendor management                         ║
║  - /api/dashboard  Dashboard & KPIs                          ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
