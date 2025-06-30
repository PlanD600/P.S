import { Request, Response, NextFunction } from 'express';
import db from '../../db';

/**
 * @desc    Create a new team
 * @route   POST /api/teams
 * @access  Private/Super Admin
 */
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
    const { teamName, team_leader_id, member_user_ids } = (req as any).body;
    if (!teamName || !team_leader_id) {
        return (res as any).status(400).json({ message: 'Team name and leader ID are required.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const teamQuery = 'INSERT INTO teams (team_name, team_leader_id) VALUES ($1, $2) RETURNING *, team_id as id, team_name as name;';
        const teamResult = await client.query(teamQuery, [teamName, team_leader_id]);
        const newTeam = teamResult.rows[0];

        const allMemberIds = [...(member_user_ids || []), team_leader_id];
        const updateUserQuery = 'UPDATE users SET team_id = $1 WHERE user_id = ANY($2::text[])';
        await client.query(updateUserQuery, [newTeam.id, allMemberIds]);
        
        await client.query('COMMIT');

        const updatedUsersResult = await client.query('SELECT user_id as id, full_name as name, email, role, team_id as "teamId" FROM users WHERE user_id = ANY($1::text[])', [allMemberIds]);

        (res as any).status(201).json({ team: newTeam, updatedUsers: updatedUsersResult.rows });

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * @desc    Add member(s) to a team
 * @route   POST /api/teams/:teamId/members
 * @access  Private/Super Admin or Team Leader
 */
export const addMembersToTeam = async (req: Request, res: Response, next: NextFunction) => {
    const { teamId } = (req as any).params;
    const { user_ids } = (req as any).body;
    const requestingUser = (req as any).user;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return (res as any).status(400).json({ message: 'User IDs array is required.' });
    }

    try {
        const teamResult = await db.query('SELECT * FROM teams WHERE team_id = $1', [teamId]);
        if (teamResult.rows.length === 0) {
            return (res as any).status(404).json({ message: 'Team not found.' });
        }
        
        if (requestingUser?.role === 'Team Leader' && teamResult.rows[0].team_leader_id !== requestingUser.id) {
            return (res as any).status(403).json({ message: 'Not authorized to add members to this team.' });
        }
        
        const updateQuery = 'UPDATE users SET team_id = $1 WHERE user_id = ANY($2::text[]) AND team_id IS NULL RETURNING user_id as id, full_name as name, email, role, team_id as "teamId"';
        const updatedUserResult = await db.query(updateQuery, [teamId, user_ids]);

        (res as any).status(200).json(updatedUserResult.rows);
    } catch (error) {
        next(error);
    }
};


/**
 * @desc    Update a team
 * @route   PUT /api/teams/:teamId
 * @access  Private/Super Admin
 */
export const updateTeam = async (req: Request, res: Response, next: NextFunction) => {
    const { teamId } = (req as any).params;
    const { teamName, leaderId, memberIds } = (req as any).body;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        const teamUpdateQuery = `UPDATE teams SET team_name = $1, team_leader_id = $2 WHERE team_id = $3 RETURNING *, team_id as id, team_name as name;`;
        const teamResult = await client.query(teamUpdateQuery, [teamName, leaderId, teamId]);
        if (teamResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return (res as any).status(404).json({ message: "Team not found" });
        }
        
        const currentMembersResult = await client.query('SELECT user_id FROM users WHERE team_id = $1', [teamId]);
        const currentMemberIds = new Set(currentMembersResult.rows.map(r => r.user_id));
        
        const newMemberIds = new Set([...memberIds, leaderId]);
        const usersToRemove = [...currentMemberIds].filter(id => !newMemberIds.has(id));
        const usersToAdd = [...newMemberIds].filter(id => !currentMemberIds.has(id));

        if (usersToRemove.length > 0) {
            await client.query('UPDATE users SET team_id = NULL WHERE user_id = ANY($1::text[])', [usersToRemove]);
        }
        if (usersToAdd.length > 0) {
            await client.query('UPDATE users SET team_id = $1 WHERE user_id = ANY($2::text[])', [teamId, usersToAdd]);
        }
        
        await client.query('COMMIT');

        const allAffectedIds = [...new Set([...usersToAdd, ...usersToRemove, ...memberIds, leaderId])];
        const updatedUsersResult = await client.query('SELECT user_id as id, full_name as name, email, role, team_id as "teamId" FROM users WHERE user_id = ANY($1::text[])', [allAffectedIds]);

        (res as any).json({ team: teamResult.rows[0], updatedUsers: updatedUsersResult.rows });

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * @desc    Delete a team
 * @route   DELETE /api/teams/:teamId
 * @access  Private/Super Admin
 */
export const deleteTeam = async (req: Request, res: Response, next: NextFunction) => {
    const { teamId } = (req as any).params;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        const usersResult = await client.query('UPDATE users SET team_id = NULL WHERE team_id = $1 RETURNING user_id as id, full_name as name, email, role, team_id as "teamId"', [teamId]);
        await client.query('DELETE FROM teams WHERE team_id = $1', [teamId]);

        await client.query('COMMIT');
        (res as any).json({ updatedUsers: usersResult.rows });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * @desc    Remove a user from their team
 * @route   DELETE /api/teams/:teamId/members/:userId
 * @access  Private/Super Admin or Team Leader
 */
export const removeUserFromTeam = async (req: Request, res: Response, next: NextFunction) => {
    const { teamId, userId } = (req as any).params;
    const requestingUser = (req as any).user;

    try {
        if (requestingUser?.role === 'Team Leader' && requestingUser.teamId !== teamId) {
             return (res as any).status(403).json({ message: 'Not authorized to remove members from this team.' });
        }
        
        const query = 'UPDATE users SET team_id = NULL WHERE user_id = $1 AND team_id = $2 RETURNING user_id as id, full_name as name, email, role, team_id as "teamId"';
        const result = await db.query(query, [userId, teamId]);

        if (result.rows.length === 0) {
            return (res as any).status(404).json({ message: 'User not found in the specified team.' });
        }
        (res as any).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};