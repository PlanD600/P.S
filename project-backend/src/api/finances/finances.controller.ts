import express from 'express';
import db from '../../db';

/**
 * @desc    Add a financial transaction
 * @route   POST /api/finances/entries
 * @access  Private/Super Admin or Team Leader
 */
export const addFinancialEntry = async (req: express.Request, res: express.Response) => {
    const { type, amount, description, entry_date, project_id, source } = req.body;
    const user = req.user;

    if (!type || !amount || !entry_date || !project_id || !source) {
        return res.status(400).json({ message: 'Missing required financial data.' });
    }

    // Authorization logic from specification
    if (type === 'Income' && user?.role !== 'Super Admin') {
        return res.status(403).json({ message: 'Not authorized to add income entries.' });
    }

    try {
        const query = `
            INSERT INTO financial_entries (entry_type, amount, description, entry_date, project_id, source)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
        `;
        const result = await db.query(query, [type, amount, description, entry_date, project_id, source]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding financial entry:', error);
        res.status(500).json({ message: 'Server error adding financial entry' });
    }
};

/**
 * @desc    Get a financial summary
 * @route   GET /api/finances/summary
 * @access  Private/Super Admin or Team Leader
 */
export const getFinancialSummary = async (req: express.Request, res: express.Response) => {
    const user = req.user;
    const { team_id } = req.query; // For admin filtering

    try {
        if (user?.role === 'Super Admin') {
            const query = `
                SELECT 
                    SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END) as total_income,
                    SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END) as total_expense
                FROM financial_entries fe
                JOIN projects p ON fe.project_id = p.project_id
                ${team_id ? 'WHERE p.team_id = $1' : ''};
            `;
            const result = await db.query(query, team_id ? [team_id as string] : []);
            res.json(result.rows[0]);
        } else if (user?.role === 'Team Leader') {
            const query = `
                SELECT 
                    SUM(amount) as total_team_expenses
                FROM financial_entries fe
                JOIN projects p ON fe.project_id = p.project_id
                WHERE p.team_id = $1 AND fe.entry_type = 'expense';
            `;
            const result = await db.query(query, [user.teamId]);
            res.json(result.rows[0]);
        }
    } catch (error) {
        console.error('Error getting financial summary:', error);
        res.status(500).json({ message: 'Server error getting financial summary' });
    }
};
