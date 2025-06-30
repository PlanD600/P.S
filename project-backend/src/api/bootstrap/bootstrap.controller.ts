import { Request, Response, NextFunction } from 'express';
import db from '../../db';

const getFullTaskViewModel = (taskDbRow: any, allAssignees: any[], allDependencies: any[], allComments: any[]) => {
    return {
        ...taskDbRow,
        assigneeIds: allAssignees.filter(a => a.task_id === taskDbRow.id).map(a => a.user_id),
        dependencies: allDependencies.filter(d => d.target_task_id === taskDbRow.id).map(d => d.source_task_id),
        comments: allComments.filter(c => c.task_id === taskDbRow.id).map(c => ({
            id: c.comment_id,
            text: c.content,
            timestamp: c.timestamp,
            parentId: c.parent_id,
            user: { id: c.user_id, name: c.full_name, avatarUrl: c.avatar_url, role: c.role, email: c.email }
        })),
    };
};


/**
 * @desc    Get all initial data for the application after login
 * @route   GET /api/bootstrap
 * @access  Private
 */
export const getInitialData = async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return (res as any).status(401).json({ message: 'Not authorized' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        const usersResult = await client.query('SELECT user_id as id, full_name as name, email, role, team_id as "teamId", disabled, avatar_url as "avatarUrl", project_id as "projectId", notification_preferences as "notificationPreferences" FROM users ORDER BY full_name');
        const teamsResult = await client.query('SELECT team_id as id, team_name as name FROM teams');

        let projectsResult;
        if (user.role === 'Super Admin') {
            projectsResult = await client.query('SELECT project_id as id, title as name, description, team_id as "teamId", budget, start_date as "startDate", end_date as "endDate" FROM projects ORDER BY start_date DESC');
        } else if (user.role === 'Team Leader') {
            projectsResult = await client.query('SELECT project_id as id, title as name, description, team_id as "teamId", budget, start_date as "startDate", end_date as "endDate" FROM projects WHERE team_id = $1 ORDER BY start_date DESC', [user.teamId]);
        } else {
             const projectIdsQuery = `
                SELECT DISTINCT p.project_id FROM projects p
                LEFT JOIN tasks t ON p.project_id = t.project_id
                LEFT JOIN task_assignees ta ON t.task_id = ta.task_id
                WHERE ta.user_id = $1 OR p.project_id = (SELECT project_id FROM users WHERE user_id = $1);
            `;
            const accessibleProjectIdsResult = await client.query(projectIdsQuery, [user.id]);
            const accessibleProjectIds = accessibleProjectIdsResult.rows.map(r => r.project_id);
            
            if (accessibleProjectIds.length > 0) {
                 projectsResult = await client.query('SELECT project_id as id, title as name, description, team_id as "teamId", budget, start_date as "startDate", end_date as "endDate" FROM projects WHERE project_id = ANY($1::text[])', [accessibleProjectIds]);
            } else {
                projectsResult = { rows: [] };
            }
        }
        
        const projectIds = projectsResult.rows.map(p => p.id);
        let tasksResult = { rows: [] };
        let financialsResult = { rows: [] };
        let assigneesResult = { rows: [] };
        let dependenciesResult = { rows: [] };
        let commentsResult = { rows: [] };

        if (projectIds.length > 0) {
            tasksResult = await client.query('SELECT *, task_id as id, "columnId", start_date as "startDate", end_date as "endDate", planned_cost as "plannedCost", actual_cost as "actualCost", baseline_start_date as "baselineStartDate", baseline_end_date as "baselineEndDate", project_id as "projectId", is_milestone as "isMilestone", parent_id as "parentId" FROM tasks WHERE project_id = ANY($1::text[])', [projectIds]);
            financialsResult = await client.query('SELECT entry_id as id, entry_type as type, entry_date as date, source, description, amount, project_id as "projectId" FROM financial_entries WHERE project_id = ANY($1::text[])', [projectIds]);
            
            const taskIds = tasksResult.rows.map(t => t.id);
            if (taskIds.length > 0) {
                assigneesResult = await client.query('SELECT * FROM task_assignees WHERE task_id = ANY($1::text[])', [taskIds]);
                dependenciesResult = await client.query('SELECT * FROM task_dependencies WHERE target_task_id = ANY($1::text[])', [taskIds]);
                commentsResult = await client.query(`
                    SELECT c.*, u.full_name, u.avatar_url, u.role, u.email 
                    FROM comments c JOIN users u ON c.user_id = u.user_id
                    WHERE c.task_id = ANY($1::text[]) ORDER BY c.timestamp ASC
                `, [taskIds]);
            }
        }

        await client.query('COMMIT');
        
        const tasksViewModel = tasksResult.rows.map(task => getFullTaskViewModel(task, assigneesResult.rows, dependenciesResult.rows, commentsResult.rows));
        
        const organizationSettings = { name: 'מנהל פרויקטים חכם', logoUrl: '' };

        (res as any).json({
            users: usersResult.rows,
            teams: teamsResult.rows,
            projects: projectsResult.rows,
            tasks: tasksViewModel,
            financials: financialsResult.rows,
            organizationSettings: organizationSettings,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};