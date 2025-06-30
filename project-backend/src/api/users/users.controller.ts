import { Request, Response, NextFunction } from 'express';
import db from '../../db';
import bcrypt from 'bcrypt';

/**
 * @desc    Create a new user (by Admin) or Invite Guest
 * @route   POST /api/users
 * @access  Private/Super Admin
 */
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, role, teamId, projectId } = (req as any).body;
    if (!name || !email || !role) {
        return (res as any).status(400).json({ message: 'Please provide name, email, and role' });
    }
     if (role === 'Guest' && !projectId) {
        return (res as any).status(400).json({ message: 'Guests must be associated with a project.' });
    }

    try {
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return (res as any).status(400).json({ message: 'User with this email already exists' });
        }

        // Generate a temporary random password. User will reset it via email link.
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);
        
        const newUserQuery = `
            INSERT INTO users (full_name, email, password_hash, role, team_id, project_id) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, full_name, email, role, team_id, project_id, disabled;
        `;
        const result = await db.query(newUserQuery, [name, email, hashedPassword, role, teamId, projectId]);
        
        // TODO: Send an invitation email to the user with a password creation link.

        (res as any).status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};


/**
 * @desc    Get all users (for admins)
 * @route   GET /api/users
 * @access  Private/Super Admin
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Query excludes password hash for security
        const result = await db.query('SELECT user_id, full_name, email, role, team_id, disabled, avatar_url, project_id FROM users ORDER BY full_name');
        (res as any).json(result.rows);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all unassigned employees
 * @route   GET /api/users/unassigned
 * @access  Private/Super Admin, Team Leader
 */
export const getUnassignedUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await db.query(
            "SELECT user_id, full_name, email FROM users WHERE role = 'Employee' AND team_id IS NULL AND disabled = false ORDER BY full_name"
        );
        (res as any).json(result.rows);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update a user
 * @route   PUT /api/users/:userId
 * @access  Private/Super Admin
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = (req as any).params;
    const { name, email, role, teamId, disabled } = (req as any).body;
     // Basic validation
    if (!name || !email || !role) {
        return (res as any).status(400).json({ message: 'Name, email, and role are required' });
    }

    try {
        // TODO: Add more granular authorization (e.g., user can update their own profile)
        const query = `
            UPDATE users 
            SET full_name = $1, email = $2, role = $3, team_id = $4, disabled = $5
            WHERE user_id = $6
            RETURNING user_id, full_name, email, role, team_id, disabled, avatar_url;
        `;
        const result = await db.query(query, [name, email, role, teamId, disabled, userId]);
        if(result.rows.length === 0) {
            return (res as any).status(404).json({ message: 'User not found' });
        }
        (res as any).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};


/**
 * @desc    Delete (disable) a user
 * @route   DELETE /api/users/:userId
 * @access  Private/Super Admin
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = (req as any).params;

    try {
        // For guests, we can hard delete them. For regular users, we soft delete (disable).
        const userResult = await db.query('SELECT role FROM users WHERE user_id = $1', [userId]);
        if (userResult.rows.length === 0) {
             return (res as any).status(404).json({ message: 'User not found' });
        }

        if(userResult.rows[0].role === 'Guest') {
            await db.query('DELETE FROM users WHERE user_id = $1', [userId]);
            return (res as any).status(204).send(); // No Content
        } else {
            const query = `
                UPDATE users SET disabled = true WHERE user_id = $1
                RETURNING user_id, full_name, email, role, team_id, disabled, avatar_url;
            `;
            const result = await db.query(query, [userId]);
             if (result.rows.length === 0) {
                return (res as any).status(404).json({ message: 'User not found' });
            }
            (res as any).json(result.rows[0]);
        }
    } catch (error) {
        next(error);
    }
};