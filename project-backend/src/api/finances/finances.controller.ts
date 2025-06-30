import { Request, Response, NextFunction } from 'express';
import db from '../../db';

/**
 * @desc    Add a financial transaction
 * @route   POST /api/finances/entries
 * @access  Private/Super Admin or Team Leader
 */
export const addFinancialEntry = async (req: Request, res: Response, next: NextFunction) => {
    const { type, amount, description, date, projectId, source } = (req as any).body;
    const user = (req as any).user;

    if (!type || !amount || !date || !projectId || !source) {
        return (res as any).status(400).json({ message: 'Missing required financial data.' });
    }

    if (type === 'Income' && user?.role !== 'Super Admin') {
        return (res as any).status(403).json({ message: 'Not authorized to add income entries.' });
    }

    try {
        const query = `
            INSERT INTO financial_entries (entry_type, amount, description, entry_date, project_id, source)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *, entry_id as id, entry_type as type, entry_date as date, project_id as "projectId";
        `;
        const result = await db.query(query, [type, amount, description, date, projectId, source]);
        (res as any).status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get a financial summary
 * @route   GET /api/finances/summary
 * @access  Private/Super Admin or Team Leader
 */
export const getFinancialSummary = async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { team_id } = (req as any).query;

    try {
        if (user?.role === 'Super Admin') {
            const query = `
                SELECT 
                    SUM(CASE WHEN entry_type = 'Income' THEN amount ELSE 0 END) as total_income,
                    SUM(CASE WHEN entry_type = 'Expense' THEN amount ELSE 0 END) as total_expense
                FROM financial_entries fe
                ${team_id ? 'JOIN projects p ON fe.project_id = p.project_id WHERE p.team_id = $1' : ''};
            `;
            const result = await db.query(query, team_id ? [team_id as string] : []);
            (res as any).json(result.rows[0]);
        } else if (user?.role === 'Team Leader') {
            const query = `
                SELECT 
                    SUM(amount) as total_team_expenses
                FROM financial_entries fe
                JOIN projects p ON fe.project_id = p.project_id
                WHERE p.team_id = $1 AND fe.entry_type = 'Expense';
            `;
            const result = await db.query(query, [user.teamId]);
            (res as any).json(result.rows[0]);
        }
    } catch (error) {
        next(error);
    }
};