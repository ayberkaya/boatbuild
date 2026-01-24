/**
 * Document Routes
 * BoatBuild CRM - Document upload and management
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../db/connection');
const { authenticate, requireAuthenticated, logAudit } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dateFolder = new Date().toISOString().split('T')[0];
        const destPath = path.join(uploadDir, dateFolder);
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }
        cb(null, destPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: PDF, images, Word, Excel'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
    }
});

/**
 * GET /api/documents
 * List documents with filtering
 */
router.get('/', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { expense_id, transfer_id, vendor_id, document_type } = req.query;

        let whereClause = '';
        const params = [];
        let paramCount = 0;

        if (expense_id) {
            paramCount++;
            whereClause += ` AND d.expense_id = $${paramCount}`;
            params.push(expense_id);
        }

        if (transfer_id) {
            paramCount++;
            whereClause += ` AND d.transfer_id = $${paramCount}`;
            params.push(transfer_id);
        }

        if (vendor_id) {
            paramCount++;
            whereClause += ` AND d.vendor_id = $${paramCount}`;
            params.push(vendor_id);
        }

        if (document_type) {
            paramCount++;
            whereClause += ` AND d.document_type = $${paramCount}`;
            params.push(document_type);
        }

        const result = await query(`
            SELECT 
                d.*,
                u.full_name as uploaded_by_name,
                e.vendor_name as expense_vendor,
                e.amount as expense_amount,
                e.currency as expense_currency
            FROM documents d
            LEFT JOIN users u ON d.uploaded_by = u.user_id
            LEFT JOIN expenses e ON d.expense_id = e.expense_id
            WHERE 1=1 ${whereClause}
            ORDER BY d.uploaded_at DESC
        `, params);

        res.json({
            success: true,
            data: {
                documents: result.rows
            }
        });
    } catch (error) {
        console.error('[Documents] List error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch documents'
        });
    }
});

/**
 * POST /api/documents/upload
 * Upload document
 */
router.post('/upload', authenticate, requireAuthenticated, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const { expense_id, transfer_id, vendor_id, document_type, description } = req.body;

        // Validate at least one reference
        if (!expense_id && !transfer_id && !vendor_id) {
            // Delete uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Document must be linked to an expense, transfer, or vendor'
            });
        }

        const document_id = uuidv4();

        const result = await transaction(async (client) => {
            const insertResult = await client.query(`
                INSERT INTO documents (
                    document_id, expense_id, transfer_id, vendor_id,
                    document_type, file_name, file_path, file_size,
                    mime_type, description, uploaded_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                document_id, expense_id || null, transfer_id || null, vendor_id || null,
                document_type || 'OTHER', req.file.originalname, req.file.path,
                req.file.size, req.file.mimetype, description, req.user.user_id
            ]);

            // If linked to expense, check if this resolves missing document alert
            if (expense_id) {
                await client.query(`
                    UPDATE alerts SET 
                        is_resolved = true, 
                        resolved_at = NOW(), 
                        resolved_by = $1,
                        resolution_notes = 'Document uploaded'
                    WHERE expense_id = $2 
                    AND alert_type = 'MISSING_DOCUMENT' 
                    AND is_resolved = false
                `, [req.user.user_id, expense_id]);
            }

            return insertResult.rows[0];
        });

        await logAudit(req.user.user_id, 'UPLOAD_DOCUMENT', 'documents', document_id, null, result, req);

        res.status(201).json({
            success: true,
            data: {
                document: result
            }
        });
    } catch (error) {
        console.error('[Documents] Upload error:', error);
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: 'Failed to upload document'
        });
    }
});

/**
 * GET /api/documents/:id/preview
 * Preview document (inline display)
 */
router.get('/:id/preview', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM documents WHERE document_id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const doc = result.rows[0];

        if (!fs.existsSync(doc.file_path)) {
            return res.status(404).json({
                success: false,
                error: 'File not found on server'
            });
        }

        // Set headers for inline display
        res.setHeader('Content-Type', doc.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
        res.sendFile(path.resolve(doc.file_path));
    } catch (error) {
        console.error('[Documents] Preview error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to preview document'
        });
    }
});

/**
 * GET /api/documents/:id/download
 * Download document
 */
router.get('/:id/download', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM documents WHERE document_id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const doc = result.rows[0];

        if (!fs.existsSync(doc.file_path)) {
            return res.status(404).json({
                success: false,
                error: 'File not found on server'
            });
        }

        res.download(doc.file_path, doc.file_name);
    } catch (error) {
        console.error('[Documents] Download error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download document'
        });
    }
});

/**
 * DELETE /api/documents/:id
 * Delete document
 */
router.delete('/:id', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM documents WHERE document_id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const doc = result.rows[0];

        // Delete from database
        await query('DELETE FROM documents WHERE document_id = $1', [id]);

        // Delete file from disk
        if (fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
        }

        await logAudit(req.user.user_id, 'DELETE_DOCUMENT', 'documents', id, doc, null, req);

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });
    } catch (error) {
        console.error('[Documents] Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete document'
        });
    }
});

/**
 * GET /api/documents/missing
 * Get expenses missing required documentation
 */
router.get('/missing/list', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                e.expense_id,
                e.date,
                e.vendor_name,
                e.amount,
                e.primary_tag,
                e.work_scope_level,
                a.message as alert_message
            FROM expenses e
            JOIN alerts a ON e.expense_id = a.expense_id
            WHERE a.alert_type = 'MISSING_DOCUMENT'
            AND a.is_resolved = false
            ORDER BY e.date DESC
        `);

        res.json({
            success: true,
            data: {
                expenses_missing_docs: result.rows,
                count: result.rows.length
            }
        });
    } catch (error) {
        console.error('[Documents] Missing list error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch missing documents list'
        });
    }
});

module.exports = router;
