import express from 'express';
import db from '../../db';

// Helper to assemble a full task object from DB queries
const getFullTaskViewModel = async (taskId: string, client: any = db) => {
    const taskQuery = 'SELECT * FROM tasks WHERE task_id = $1';
    const taskResult = await client.query(taskQuery, [taskId]);
    if (taskResult.rows.length === 0) return null;

    const assigneesQuery = 'SELECT user_id FROM task_assignees WHERE task_id = $1';
    const assigneesResult = await client.query(assigneesQuery, [taskId]);

    const dependenciesQuery = 'SELECT source_task_id FROM task_dependencies WHERE target_task_id = $1';
    const dependenciesResult = await client.query(dependenciesQuery, [taskId]);

    const commentsQuery = `
        SELECT c.*, u.full_name, u.avatar_url, u.role, u.email 
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
        user: { id: r.user_id, name: r.full_name, avatarUrl: r.avatar_url, role: r.role, email: r.email }
    }));
    return task;
}

/**
 * @desc    Get a single task
 * @route   GET /api/tasks/:taskId
 * @access  Private
 */
export const getTask = async (req: express.Request, res: express.Response) => {
    const { taskId } = req.params;
    // TODO: Add authorization checks
    try {
        const task = await getFullTaskViewModel(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        console.error('Error getting task:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * @desc    Update a task's full details
 * @route   PUT /api/tasks/:taskId
 * @access  Private
 */
export const updateTask = async (req: express.Request, res: express.Response) => {
    const { taskId } = req.params;
    const { title, description, startDate, endDate, columnId, assigneeIds, baselineStartDate, baselineEndDate } = req.body;
    // TODO: Authorization check
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        // Update core task details
        const updateTaskQuery = `
            UPDATE tasks SET title=$1, description=$2, start_date=$3, end_date=$4, "columnId"=$5, baseline_start_date=$6, baseline_end_date=$7
            WHERE task_id = $8
        `;
        await client.query(updateTaskQuery, [title, description, startDate, endDate, columnId, baselineStartDate, baselineEndDate, taskId]);
        
        // Update assignees
        await client.query('DELETE FROM task_assignees WHERE task_id = $1', [taskId]);
        if (assigneeIds && assigneeIds.length > 0) {
            const assigneeInsertQuery = 'INSERT INTO task_assignees (task_id, user_id) SELECT $1, unnest($2::text[])';
            await client.query(assigneeInsertQuery, [taskId, assigneeIds]);
        }

        await client.query('COMMIT');
        
        const updatedTask = await getFullTaskViewModel(taskId, client);
        res.json(updatedTask);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Server error updating task' });
    } finally {
        client.release();
    }
};

/**
 * @desc    Bulk update tasks (for Gantt)
 * @route   PATCH /api/tasks
 * @access  Private
 */
export const bulkUpdateTasks = async (req: express.Request, res: express.Response) => {
    const { tasks } = req.body;
    // TODO: Authorization check
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        for (const task of tasks) {
            // Update dates
            await client.query('UPDATE tasks SET start_date = $1, end_date = $2 WHERE task_id = $3', [task.startDate, task.endDate, task.id]);
            // Update dependencies
            await client.query('DELETE FROM task_dependencies WHERE target_task_id = $1', [task.id]);
            if (task.dependencies && task.dependencies.length > 0) {
                const depQuery = 'INSERT INTO task_dependencies (target_task_id, source_task_id) SELECT $1, unnest($2::text[])';
                await client.query(depQuery, [task.id, task.dependencies]);
            }
        }

        await client.query('COMMIT');

        const updatedTasks = await Promise.all(tasks.map((t: any) => getFullTaskViewModel(t.id, client)));
        res.json(updatedTasks);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error bulk updating tasks:', error);
        res.status(500).json({ message: 'Server error bulk updating tasks' });
    } finally {
        client.release();
    }
};


/**
 * @desc    Update task status
 * @route   PUT /api/tasks/:taskId/status
 * @access  Private
 */
export const updateTaskStatus = async (req: express.Request, res: express.Response) => {
    const { taskId } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!status) {
        return res.status(400).json({ message: 'Status is required.' });
    }

    try {
        // TODO: Complex authorization: User must be assigned to task, or be the team leader, or be an admin.
        
        const query = 'UPDATE tasks SET status = $1 WHERE task_id = $2 RETURNING *;';
        const result = await db.query(query, [status, taskId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        
        // TODO: If new status is 'stuck', send event to Notifications-Service.

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ message: 'Server error updating task status' });
    }
};

/**
 * @desc    Add a comment to a task
 * @route   POST /api/tasks/:taskId/comments
 * @access  Private
 */
export const addCommentToTask = async (req: express.Request, res: express.Response) => {
    const { taskId } = req.params;
    const { content, parent_id } = req.body;
    const user = req.user;
    
    if (!content || !user) {
        return res.status(400).json({ message: 'Content is required.' });
    }

    try {
        // TODO: Authorization: Anyone with access to the task can comment.

        const query = `
            INSERT INTO comments (content, task_id, user_id, parent_id)
            VALUES ($1, $2, $3, $4) RETURNING *;
        `;
        const result = await db.query(query, [content, taskId, user.id, parent_id]);
        
        // TODO: Send event to Notifications-Service to notify users assigned to the task.

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Server error adding comment' });
    }
};
