import express from 'express';
import db from '../../db';

/**
 * @desc    Get projects accessible by the current authenticated user
 * @route   GET /api/projects
 * @access  Private
 */
export const getProjects = async (req: express.Request, res: express.Response) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        let query: string;
        let params: (string | undefined)[] = [];
        
        if (user.role === 'Super Admin') {
            // TODO: Aggregate data as per spec (task counts, progress, budget summary)
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
        res.json(projects.rows);

    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Server error fetching projects' });
    }
};

/**
 * @desc    Create a new project
 * @route   POST /api/projects
 * @access  Private/Super Admin
 */
export const createProject = async (req: express.Request, res: express.Response) => {
    const { title, description, start_date, end_date, budget, team_id } = req.body;
    if (!title || !description || !start_date || !end_date || !team_id) {
        return res.status(400).json({ message: 'Missing required fields for project creation.' });
    }
    try {
        const query = `
            INSERT INTO projects (title, description, start_date, end_date, budget, team_id)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
        `;
        const result = await db.query(query, [title, description, start_date, end_date, budget, team_id]);
        
        // TODO: Call Finances-Service API to create a budget record if budget is provided.

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ message: 'Server error creating project' });
    }
};

/**
 * @desc    Get full project details for Gantt view
 * @route   GET /api/projects/:projectId
 * @access  Private
 */
export const getProjectDetails = async (req: express.Request, res: express.Response) => {
    const { projectId } = req.params;
    // TODO: Add authorization check to ensure user can access this project.

    try {
        // This is a simplified response. A real implementation would need to perform multiple
        // queries and assemble the full hierarchical data model required by the Gantt view.
        const projectResult = await db.query('SELECT * FROM projects WHERE project_id = $1', [projectId]);
        if (projectResult.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const tasksResult = await db.query('SELECT * FROM tasks WHERE project_id = $1', [projectId]);
        // Further queries for assignees, dependencies, comments would be needed here.

        res.json({
            ...projectResult.rows[0],
            tasks: tasksResult.rows
        });
    } catch (error) {
        console.error(`Error fetching details for project ${projectId}:`, error);
        res.status(500).json({ message: 'Server error fetching project details' });
    }
};

/**
 * @desc    Create a task in a project
 * @route   POST /api/projects/:projectId/tasks
 * @access  Private/Super Admin or Team Leader
 */
export const createTaskInProject = async (req: express.Request, res: express.Response) => {
    const { projectId } = req.params;
    // TODO: Authorize that user is Super Admin or the Team Leader for this project.

    const { title, description, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date) {
        return res.status(400).json({ message: 'Missing required fields for task creation.' });
    }

    try {
        const query = `
            INSERT INTO tasks (title, description, start_date, end_date, project_id, status)
            VALUES ($1, $2, $3, $4, $5, 'not_started') RETURNING *;
        `;
        const result = await db.query(query, [title, description, start_date, end_date, projectId]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(`Error creating task for project ${projectId}:`, error);
        res.status(500).json({ message: 'Server error creating task' });
    }
};
