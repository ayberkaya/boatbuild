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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    BoatBuild CRM Server                       ║
║                                                              ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(43)}║
║  Port: ${PORT.toString().padEnd(51)}║
║  API Base: http://localhost:${PORT}/api                        ║
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
