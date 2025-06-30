import express from 'express';
import db from '../../db';

/**
 * @desc    Create a new team
 * @route   POST /api/teams
 * @access  Private/Super Admin
 */
export const createTeam = async (req: express.Request, res: express.Response) => {
    const { teamName, team_leader_id, member_user_ids } = req.body;
    if (!teamName || !team_leader_id) {
        return res.status(400).json({ message: 'Team name and leader ID are required.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const teamQuery = 'INSERT INTO teams (team_name, team_leader_id) VALUES ($1, $2) RETURNING *;';
        const teamResult = await client.query(teamQuery, [teamName, team_leader_id]);
        const newTeam = teamResult.rows[0];

        const allMemberIds = [...(member_user_ids || []), team_leader_id];
        const updateUserQuery = 'UPDATE users SET team_id = $1 WHERE user_id = ANY($2::text[])';
        await client.query(updateUserQuery, [newTeam.team_id, allMemberIds]);
        
        await client.query('COMMIT');

        // Fetch the updated user records to return to the frontend
        const updatedUsersResult = await client.query('SELECT user_id, full_name, email, role, team_id FROM users WHERE user_id = ANY($1::text[])', [allMemberIds]);

        res.status(201).json({ team: newTeam, updatedUsers: updatedUsersResult.rows });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating team:', error);
        res.status(500).json({ message: 'Server error creating team' });
    } finally {
        client.release();
    }
};

/**
 * @desc    Add member(s) to a team
 * @route   POST /api/teams/:teamId/members
 * @access  Private/Super Admin or Team Leader
 */
export const addMembersToTeam = async (req: express.Request, res: express.Response) => {
    const { teamId } = req.params;
    const { user_ids } = req.body;
    const requestingUser = req.user;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ message: 'User IDs array is required.' });
    }

    try {
        const teamResult = await db.query('SELECT * FROM teams WHERE team_id = $1', [teamId]);
        if (teamResult.rows.length === 0) {
            return res.status(404).json({ message: 'Team not found.' });
        }
        
        // Authorization check for Team Leader
        if (requestingUser?.role === 'Team Leader' && teamResult.rows[0].team_leader_id !== requestingUser.id) {
            return res.status(403).json({ message: 'Not authorized to add members to this team.' });
        }
        
        const updateQuery = 'UPDATE users SET team_id = $1 WHERE user_id = ANY($2::text[]) AND team_id IS NULL RETURNING user_id, full_name, email, role, team_id';
        const updatedUserResult = await db.query(updateQuery, [teamId, user_ids]);

        res.status(200).json(updatedUserResult.rows);
    } catch (error) {
        console.error('Error adding members to team:', error);
        res.status(500).json({ message: 'Server error adding members' });
    }
};


/**
 * @desc    Update a team
 * @route   PUT /api/teams/:teamId
 * @access  Private/Super Admin
 */
export const updateTeam = async (req: express.Request, res: express.Response) => {
    const { teamId } = req.params;
    const { teamName, leaderId, memberIds } = req.body;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Update team name and leader
        const teamUpdateQuery = `UPDATE teams SET team_name = $1, team_leader_id = $2 WHERE team_id = $3 RETURNING *;`;
        const teamResult = await client.query(teamUpdateQuery, [teamName, leaderId, teamId]);
        if (teamResult.rows.length === 0) throw new Error("Team not found");
        
        // 2. Get all users currently in the team
        const currentMembersResult = await client.query('SELECT user_id FROM users WHERE team_id = $1', [teamId]);
        const currentMemberIds = new Set(currentMembersResult.rows.map(r => r.user_id));
        
        // 3. Determine users to add and remove
        const newMemberIds = new Set([...memberIds, leaderId]);
        const usersToRemove = [...currentMemberIds].filter(id => !newMemberIds.has(id));
        const usersToAdd = [...newMemberIds].filter(id => !currentMemberIds.has(id));

        // 4. Update users
        if (usersToRemove.length > 0) {
            await client.query('UPDATE users SET team_id = NULL WHERE user_id = ANY($1::text[])', [usersToRemove]);
        }
        if (usersToAdd.length > 0) {
            await client.query('UPDATE users SET team_id = $1 WHERE user_id = ANY($2::text[])', [teamId, usersToAdd]);
        }
        
        await client.query('COMMIT');

        // 5. Fetch all affected users to return to frontend
        const allAffectedIds = [...new Set([...usersToAdd, ...usersToRemove, ...memberIds, leaderId])];
        const updatedUsersResult = await client.query('SELECT user_id, full_name, email, role, team_id FROM users WHERE user_id = ANY($1::text[])', [allAffectedIds]);

        res.json({ team: teamResult.rows[0], updatedUsers: updatedUsersResult.rows });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating team:', error);
        res.status(500).json({ message: 'Server error updating team' });
    } finally {
        client.release();
    }
};

/**
 * @desc    Delete a team
 * @route   DELETE /api/teams/:teamId
 * @access  Private/Super Admin
 */
export const deleteTeam = async (req: express.Request, res: express.Response) => {
    const { teamId } = req.params;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        // Unassign all users from the team
        const usersResult = await client.query("UPDATE users SET team_id = NULL WHERE team_id = $1 RETURNING user_id, full_name, email, role, team_id", [teamId]);

        // Delete the team
        await client.query('DELETE FROM teams WHERE team_id = $1', [teamId]);

        await client.query('COMMIT');
        res.json({ updatedUsers: usersResult.rows });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting team:', error);
        res.status(500).json({ message: 'Server error deleting team' });
    } finally {
        client.release();
    }
};

/**
 * @desc    Remove a user from their team
 * @route   DELETE /api/teams/:teamId/members/:userId
 * @access  Private/Super Admin or Team Leader
 */
export const removeUserFromTeam = async (req: express.Request, res: express.Response) => {
    const { teamId, userId } = req.params;
    const requestingUser = req.user;

    try {
        // Authorization
        if (requestingUser?.role === 'Team Leader' && requestingUser.teamId !== teamId) {
             return res.status(403).json({ message: 'Not authorized to remove members from this team.' });
        }
        
        const query = 'UPDATE users SET team_id = NULL WHERE user_id = $1 AND team_id = $2 RETURNING user_id, full_name, email, role, team_id';
        const result = await db.query(query, [userId, teamId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found in the specified team.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error removing user from team:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
