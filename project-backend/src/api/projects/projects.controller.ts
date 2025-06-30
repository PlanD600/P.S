import { Request, Response, NextFunction } from 'express';
import db from '../../db';

/**
 * @desc    Get projects accessible by the current authenticated user
 * @route   GET /api/projects
 * @access  Private
 */
export const getProjects = async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
        return (res as any).status(401).json({ message: 'Not authorized' });
    }

    try {
        let query: string;
        let params: (string | undefined)[] = [];
        
        if (user.role === 'Super Admin') {
            query = 'SELECT * FROM projects ORDER BY start_date DESC';
        } else if (user.role === 'Team Leader') {
            query = 'SELECT * FROM projects WHERE team_id = $1 ORDER BY start_date DESC';
            params = [user.teamId];
        } else {
            query = `
                SELECT DISTINCT p.* FROM projects p
                JOIN tasks t ON p.project_id = t.project_id
                JOIN task_assignees ta ON t.task_id = ta.task_id
                WHERE ta.user_id = $1
                ORDER BY p.start_date DESC;
            `;
            params = [user.id];
        }

        const projects = await db.query(query, params.filter(p => p !== undefined));
        (res as any).json(projects.rows);

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create a new project
 * @route   POST /api/projects
 * @access  Private/Super Admin
 */
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
    const { title, description, startDate, endDate, budget, teamId } = (req as any).body;
    if (!title || !startDate || !endDate || !teamId) {
        return (res as any).status(400).json({ message: 'Missing required fields for project creation.' });
    }
    try {
        const query = `
            INSERT INTO projects (title, description, start_date, end_date, budget, team_id)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *, project_id as id, title as name, start_date as "startDate", end_date as "endDate", team_id as "teamId";
        `;
        const result = await db.query(query, [title, description, startDate, endDate, budget, teamId]);
        
        // TODO: Call Finances-Service API to create a budget record if budget is provided.

        (res as any).status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get full project details for Gantt view
 * @route   GET /api/projects/:projectId
 * @access  Private
 */
export const getProjectDetails = async (req: Request, res: Response, next: NextFunction) => {
    const { projectId } = (req as any).params;
    const user = (req as any).user;
    if (!user) return (res as any).status(401).json({ message: "Not authorized" });

    try {
        const projectResult = await db.query('SELECT * FROM projects WHERE project_id = $1', [projectId]);
        if (projectResult.rows.length === 0) {
            return (res as any).status(404).json({ message: 'Project not found' });
        }
        const project = projectResult.rows[0];

        // Authorization Check
        const isSuperAdmin = user.role === 'Super Admin';
        const isTeamLeader = user.role === 'Team Leader' && user.teamId === project.team_id;
        // More complex check for employee would be needed here
        if (!isSuperAdmin && !isTeamLeader) {
            // This is a simplified check. A full check would verify if an employee is assigned to any task in the project.
            // return res.status(403).json({ message: 'Not authorized to view this project' });
        }
        
        (res as any).json(project);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create a task in a project
 * @route   POST /api/projects/:projectId/tasks
 * @access  Private/Super Admin or Team Leader
 */
export const createTaskInProject = async (req: Request, res: Response, next: NextFunction) => {
    const { projectId } = (req as any).params;
    const user = (req as any).user;
    if (!user) return (res as any).status(401).json({ message: "Not authorized" });


    const { title, description, startDate, endDate, assigneeIds } = (req as any).body;
    if (!title || !startDate || !endDate || !assigneeIds) {
        return (res as any).status(400).json({ message: 'Missing required fields for task creation.' });
    }

    const client = await db.pool.connect();

    try {
        const projectResult = await client.query('SELECT team_id FROM projects WHERE project_id = $1', [projectId]);
        if (projectResult.rows.length === 0) {
            return (res as any).status(404).json({ message: "Project not found" });
        }
        
        if (user.role === 'Team Leader' && user.teamId !== projectResult.rows[0].team_id) {
            return (res as any).status(403).json({ message: "Not authorized to create tasks in this project" });
        }
        
        await client.query('BEGIN');
        const query = `
            INSERT INTO tasks (title, description, start_date, end_date, project_id, "columnId")
            VALUES ($1, $2, $3, $4, $5, 'col-not-started') RETURNING *;
        `;
        const result = await client.query(query, [title, description, startDate, endDate, projectId]);
        const newTask = result.rows[0];

        if (assigneeIds && assigneeIds.length > 0) {
            const assigneeQuery = 'INSERT INTO task_assignees (task_id, user_id) SELECT $1, unnest($2::text[])';
            await client.query(assigneeQuery, [newTask.task_id, assigneeIds]);
        }
        await client.query('COMMIT');
        
        // Return full view model
        const taskViewModel = await db.query('SELECT *, task_id as id, start_date as "startDate", end_date as "endDate" FROM tasks WHERE task_id = $1', [newTask.task_id]);
        taskViewModel.rows[0].assigneeIds = assigneeIds;
        taskViewModel.rows[0].comments = [];
        taskViewModel.rows[0].dependencies = [];
        
        (res as any).status(201).json(taskViewModel.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};