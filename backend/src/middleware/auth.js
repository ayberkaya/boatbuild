/**
 * Authentication Middleware
 * BoatBuild CRM - JWT-based authentication and role-based access control
 */

const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret';

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const token = authHeader.substring(7);
        
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }

        // Fetch user from database
        const result = await query(
            'SELECT user_id, email, full_name, role, is_active FROM users WHERE user_id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Account is deactivated',
                code: 'ACCOUNT_INACTIVE'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('[Auth] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication error',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Require specific role(s)
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
                required_roles: allowedRoles,
                current_role: req.user.role
            });
        }

        next();
    };
};

/**
 * Require Owner role
 */
const requireOwner = requireRole('OWNER');

/**
 * Require Operation role
 */
const requireOperation = requireRole('OPERATION');

/**
 * Allow both Owner and Operation
 */
const requireAuthenticated = requireRole('OWNER', 'OPERATION');

/**
 * Generate JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.user_id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

/**
 * Log audit action
 */
const logAudit = async (userId, action, entityType, entityId, oldValues, newValues, req) => {
    try {
        await query(
            `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                userId,
                action,
                entityType,
                entityId,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                req?.ip || null,
                req?.headers?.['user-agent'] || null
            ]
        );
    } catch (error) {
        console.error('[Audit] Failed to log action:', error);
    }
};

module.exports = {
    authenticate,
    requireRole,
    requireOwner,
    requireOperation,
    requireAuthenticated,
    generateToken,
    logAudit
};
