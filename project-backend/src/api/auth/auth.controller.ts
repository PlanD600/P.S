import { Request, Response, NextFunction } from 'express';
import db from '../../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Helper to generate a JWT for a user
const generateToken = (id: string, role: string, teamId?: string) => {
    const payload = { id, role, teamId };
    const secret = process.env.JWT_SECRET!;
    const options = {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    };
    return jwt.sign(payload, secret, options as any);
};

/**
 * @desc    Register a new organization and Super Admin user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
    const { fullName, email, password, companyName } = (req as any).body;
    if (!fullName || !email || !password || !companyName) {
        return (res as any).status(400).json({ message: 'Please provide all required fields' });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        const userExists = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return (res as any).status(400).json({ message: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUserQuery = `
            INSERT INTO users (full_name, email, password_hash, role) 
            VALUES ($1, $2, $3, 'Super Admin') RETURNING user_id, full_name, email, role;
        `;
        const result = await client.query(newUserQuery, [fullName, email, hashedPassword]);
        const newUser = result.rows[0];

        // In a real multi-tenant app, we would create an organization record here.
        // For now, it's implicitly handled.
        
        await client.query('COMMIT');
        
        const responseUser = {
            id: newUser.user_id,
            name: newUser.full_name,
            email: newUser.email,
            role: newUser.role,
            token: generateToken(newUser.user_id, newUser.role),
        };

        (res as any).status(201).json(responseUser);
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * @desc    Authenticate a user and get a token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = (req as any).body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1 AND disabled = false', [email]);
        const user = result.rows[0];

        if (user && (await bcrypt.compare(password, user.password_hash))) {
            (res as any).json({
                id: user.user_id,
                name: user.full_name,
                email: user.email,
                role: user.role,
                teamId: user.team_id,
                avatarUrl: user.avatar_url,
                notificationPreferences: user.notification_preferences,
                token: generateToken(user.user_id, user.role, user.team_id),
            });
        } else {
            (res as any).status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        next(error);
    }
};