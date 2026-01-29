/**
 * Authentication Routes
 * BoatBuild CRM - User authentication and management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/connection');
const { authenticate, generateToken, logAudit, requireOwner } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', [
    body('email').isEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;
        
        // Normalize email to lowercase for comparison
        const normalizedEmail = email.toLowerCase().trim();

        const result = await query(
            'SELECT user_id, email, password_hash, full_name, role, is_active FROM users WHERE LOWER(email) = $1',
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            console.error('[Auth] Login failed: User not found', { email: normalizedEmail });
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            console.error('[Auth] Login failed: Account deactivated', { email: normalizedEmail });
            return res.status(403).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            console.error('[Auth] Login failed: Invalid password', { email: normalizedEmail });
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const token = generateToken(user);

        await logAudit(user.user_id, 'LOGIN', 'users', user.user_id, null, null, req);

        res.json({
            success: true,
            data: {
                token,
                user: {
                    user_id: user.user_id,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role
                }
            }
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req, res) => {
    res.json({
        success: true,
        data: {
            user: req.user
        }
    });
});

/**
 * POST /api/auth/register
 * Register new user (Owner only)
 */
router.post('/register', authenticate, requireOwner, [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('full_name').notEmpty().trim(),
    body('role').isIn(['OWNER', 'OPERATION'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password, full_name, role } = req.body;

        // Check if email already exists
        const existingUser = await query('SELECT user_id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING user_id, email, full_name, role, created_at`,
            [email, passwordHash, full_name, role]
        );

        await logAudit(req.user.user_id, 'CREATE_USER', 'users', result.rows[0].user_id, null, result.rows[0], req);

        res.status(201).json({
            success: true,
            data: {
                user: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate, [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 8 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { current_password, new_password } = req.body;

        const result = await query(
            'SELECT password_hash FROM users WHERE user_id = $1',
            [req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const isValidPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        const newPasswordHash = await bcrypt.hash(new_password, 12);

        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
            [newPasswordHash, req.user.user_id]
        );

        await logAudit(req.user.user_id, 'CHANGE_PASSWORD', 'users', req.user.user_id, null, null, req);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('[Auth] Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Password change failed'
        });
    }
});

module.exports = router;
