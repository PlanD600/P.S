import express from 'express';
import db from '../../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Helper to generate a JWT for a user
const generateToken = (id: string, role: string, teamId?: string) => {
    const payload = { id, role, teamId };
    const secret = process.env.JWT_SECRET!;
    const options: jwt.SignOptions = {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    };
    return jwt.sign(payload, secret, options);
};

/**
 * @desc    Register a new organization and Super Admin user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = async (req: express.Request, res: express.Response) => {
    const { fullName, email, password, companyName } = req.body;
    if (!fullName || !email || !password || !companyName) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        // In a real multi-tenant app, we'd wrap this in a transaction
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // TODO: Create a new Organization record with `companyName`

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUserQuery = `
            INSERT INTO users (full_name, email, password_hash, role) 
            VALUES ($1, $2, $3, 'super_admin') RETURNING user_id, full_name, email, role;
        `;
        const result = await db.query(newUserQuery, [fullName, email, hashedPassword]);
        const newUser = result.rows[0];

        // TODO: Associate user with the new organization
        // TODO: Send verification email

        res.status(201).json({
            id: newUser.user_id,
            name: newUser.full_name,
            email: newUser.email,
            role: newUser.role,
            token: generateToken(newUser.user_id, newUser.role),
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

/**
 * @desc    Authenticate a user and get a token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1 AND disabled = false', [email]);
        const user = result.rows[0];

        if (user && (await bcrypt.compare(password, user.password_hash))) {
            res.json({
                id: user.user_id,
                name: user.full_name,
                email: user.email,
                role: user.role,
                teamId: user.team_id,
                token: generateToken(user.user_id, user.role, user.team_id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};
