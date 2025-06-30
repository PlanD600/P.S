import { Request, Response, NextFunction } from 'express';
import db from '../../db';

// Helper to assemble a full task object from DB queries
const getFullTaskViewModel = async (taskId: string, client: any = db) => {
    const taskQuery = 'SELECT *, task_id as id, "columnId" as "columnId", start_date as "startDate", end_date as "endDate", planned_cost as "plannedCost", actual_cost as "actualCost", baseline_start_date as "baselineStartDate", baseline_end_date as "baselineEndDate", project_id as "projectId", is_milestone as "isMilestone", parent_id as "parentId" FROM tasks WHERE task_id = $1';
    const taskResult = await client.query(taskQuery, [taskId]);
    if (taskResult.rows.length === 0) return null;

    const assigneesQuery = 'SELECT user_id FROM task_assignees WHERE task_id = $1';
    const assigneesResult = await client.query(assigneesQuery, [taskId]);

    const dependenciesQuery = 'SELECT source_task_id FROM task_dependencies WHERE target_task_id = $1';
    const dependenciesResult = await client.query(dependenciesQuery, [taskId]);

    const commentsQuery = `
        SELECT c.*, u.full_name as name, u.avatar_url as "avatarUrl", u.role, u.email 
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.task_id = $1
        ORDER BY c.timestamp ASC
    `;
    const commentsResult = await client.query(commentsQuery, [taskId]);

    const task = taskResult.rows[0];
    task.assigneeIds = assigneesResult.rows.map((r: any) => r.user_id);
    task.dependencies = dependenciesResult.rows.map((r: any) => r.source_task_id);
    task.comments = commentsResult.rows.map((r: any) => ({
        id: r.comment_id,
        text: r.content,
        timestamp: r.timestamp,
        parentId: r.parent_id,
        user: { id: r.user_id, name: r.name, avatarUrl: r.avatarUrl, role: r.role, email: r.email }
    }));
    return task;
}

/**
 * @desc    Get a single task
 * @route   GET /api/tasks/:taskId
 * @access  Private
 */
export const getTask = async (req: Request, res: Response, next: NextFunction) => {
    const { taskId } = (req as any).params;
    // TODO: Add authorization checks
    try {
        const task = await getFullTaskViewModel(taskId);
        if (!task) {
            return (res as any).status(404).json({ message: 'Task not found' });
        }
        (res as any).json(task);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update a task's full details
 * @route   PUT /api/tasks/:taskId
 * @access  Private
 */
export const updateTask = async (req: Request, res: Response, next: NextFunction) => {
    const { taskId } = (req as any).params;
    const { title, description, startDate, endDate, columnId, assigneeIds, baselineStartDate, baselineEndDate } = (req as any).body;
    // TODO: Authorization check
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        const updateTaskQuery = `
            UPDATE tasks SET title=$1, description=$2, start_date=$3, end_date=$4, "columnId"=$5, baseline_start_date=$6, baseline_end_date=$7
            WHERE task_id = $8
        `;
        await client.query(updateTaskQuery, [title, description, startDate, endDate, columnId, baselineStartDate, baselineEndDate, taskId]);
        
        await client.query('DELETE FROM task_assignees WHERE task_id = $1', [taskId]);
        if (assigneeIds && assigneeIds.length > 0) {
            const assigneeInsertQuery = 'INSERT INTO task_assignees (task_id, user_id) SELECT $1, unnest($2::text[])';
            await client.query(assigneeInsertQuery, [taskId, assigneeIds]);
        }

        await client.query('COMMIT');
        
        const updatedTask = await getFullTaskViewModel(taskId, client);
        (res as any).json(updatedTask);

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * @desc    Bulk update tasks (for Gantt)
 * @route   PATCH /api/tasks
 * @access  Private
 */
export const bulkUpdateTasks = async (req: Request, res: Response, next: NextFunction) => {
    const { tasks } = (req as any).body;
    // TODO: Authorization check
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        for (const task of tasks) {
            await client.query('UPDATE tasks SET start_date = $1, end_date = $2 WHERE task_id = $3', [task.startDate, task.endDate, task.id]);
            await client.query('DELETE FROM task_dependencies WHERE target_task_id = $1', [task.id]);
            if (task.dependencies && task.dependencies.length > 0) {
                const depQuery = 'INSERT INTO task_dependencies (target_task_id, source_task_id) SELECT $1, unnest($2::text[])';
                await client.query(depQuery, [task.id, task.dependencies]);
            }
        }

        await client.query('COMMIT');

        const updatedTasks = await Promise.all(tasks.map((t: any) => getFullTaskViewModel(t.id, client)));
        (res as any).json(updatedTasks);

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};


/**
 * @desc    Update task status
 * @route   PUT /api/tasks/:taskId/status
 * @access  Private
 */
export const updateTaskStatus = async (req: Request, res: Response, next: NextFunction) => {
    const { taskId } = (req as any).params;
    const { status } = (req as any).body;

    if (!status) {
        return (res as any).status(400).json({ message: 'Status is required.' });
    }

    try {
        // TODO: Complex authorization
        
        const query = 'UPDATE tasks SET "columnId" = $1 WHERE task_id = $2 RETURNING *;';
        const result = await db.query(query, [status, taskId]);

        if (result.rows.length === 0) {
            return (res as any).status(404).json({ message: 'Task not found.' });
        }
        
        // TODO: If new status is 'stuck', send event to Notifications-Service.

        (res as any).status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Add a comment to a task
 * @route   POST /api/tasks/:taskId/comments
 * @access  Private
 */
export const addCommentToTask = async (req: Request, res: Response, next: NextFunction) => {
    const { taskId } = (req as any).params;
    const { content, parentId } = (req as any).body;
    const user = (req as any).user;
    
    if (!content || !user) {
        return (res as any).status(400).json({ message: 'Content is required.' });
    }

    try {
        // TODO: Authorization
        const query = `
            INSERT INTO comments (content, task_id, user_id, parent_id)
            VALUES ($1, $2, $3, $4);
        `;
        await db.query(query, [content, taskId, user.id, parentId]);
        
        const updatedTask = await getFullTaskViewModel(taskId);
        if (!updatedTask) {
            return (res as any).status(404).json({ message: "Task not found after adding comment." });
        }

        (res as any).status(201).json(updatedTask);
    } catch (error) {
        next(error);
    }
};