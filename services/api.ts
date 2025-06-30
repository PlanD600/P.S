import { User, Task, Project, Team, FinancialTransaction, Comment } from '../types';

const BASE_URL = '/api'; // Assuming same-origin deployment
let token: string | null = localStorage.getItem('jwt_token');

const setToken = (newToken: string) => {
    token = newToken;
    localStorage.setItem('jwt_token', newToken);
};

const clearToken = () => {
    token = null;
    localStorage.removeItem('jwt_token');
};

const getToken = (): string | null => {
    return token;
};

const getUserIdFromToken = (): string | null => {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id;
    } catch (e) {
        console.error("Failed to parse token:", e);
        return null;
    }
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'An error occurred with the request.');
    }

    if (response.status === 204) { // No Content
        return null;
    }
    
    return response.json();
}

export const api = {
    // --- Auth ---
    login: async (email: string, password: string): Promise<User | null> => {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (data && data.token) {
            setToken(data.token);
            return data as User;
        }
        return null;
    },

    register: async (registrationData: { fullName: string; email: string; password: string; companyName: string; }): Promise<{ user: User, organizationSettings: { name: string, logoUrl: string } }> => {
        const data = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify(registrationData),
        });
         if (data && data.token) {
            setToken(data.token);
            // This is a bit of a hack since the backend doesn't return the full org settings object
            return { user: data, organizationSettings: { name: registrationData.companyName, logoUrl: '' } };
        }
        throw new Error("Registration failed to return user data.");
    },
    
    clearToken,
    getToken,
    getUserIdFromToken,

    // --- Initial Data Fetch ---
    getInitialData: async (): Promise<{users: User[], teams: Team[], projects: Project[], tasks: Task[], financials: FinancialTransaction[], organizationSettings: {name: string, logoUrl: string}}> => {
        return apiFetch('/bootstrap');
    },
    
    // --- Tasks ---
    updateTask: async (updatedTask: Task): Promise<Task> => {
        return apiFetch(`/tasks/${updatedTask.id}`, {
            method: 'PUT',
            body: JSON.stringify(updatedTask),
        });
    },
    
    bulkUpdateTasks: async (updatedTasks: Task[]): Promise<Task[]> => {
        return apiFetch('/tasks', {
            method: 'PATCH',
            body: JSON.stringify({ tasks: updatedTasks }),
        });
    },

    addTask: async (taskData: Omit<Task, 'id'>): Promise<Task> => {
        return apiFetch(`/projects/${taskData.projectId}/tasks`, {
            method: 'POST',
            body: JSON.stringify(taskData),
        });
    },

    addComment: async(taskId: string, comment: Comment): Promise<Task> => {
        return apiFetch(`/tasks/${taskId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content: comment.text, parentId: comment.parentId })
        });
    },
    
    // --- Financials ---
    addFinancialTransaction: async(transactionData: Omit<FinancialTransaction, 'id'>): Promise<FinancialTransaction> => {
        return apiFetch('/finances/entries', {
            method: 'POST',
            body: JSON.stringify(transactionData),
        });
    },

    // --- Projects ---
    createProject: async(projectData: Omit<Project, 'id'>): Promise<Project> => {
        return apiFetch('/projects', {
            method: 'POST',
            body: JSON.stringify(projectData),
        });
    },

    // --- Guests ---
    inviteGuest: async(email: string, projectId: string): Promise<User> => {
         return api.createUser({ 
             name: email.split('@')[0], 
             email: email, 
             role: 'Guest',
             projectId: projectId,
         });
    },

    revokeGuest: async(guestId: string): Promise<void> => {
        return apiFetch(`/users/${guestId}`, { method: 'DELETE' });
    },
    
    // --- Users ---
    updateUser: async(updatedUser: User): Promise<User> => {
        return apiFetch(`/users/${updatedUser.id}`, {
            method: 'PUT',
            body: JSON.stringify(updatedUser)
        });
    },

    createUser: async (newUserData: Omit<User, 'id' | 'avatarUrl'>): Promise<User> => {
        return apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify(newUserData),
        });
    },

    deleteUser: async(userId: string): Promise<User> => {
        // The backend performs a soft-delete, which is what the frontend expects (disabled state)
        return apiFetch(`/users/${userId}`, { method: 'DELETE' });
    },
    
    // --- Teams ---
    createTeam: async(newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => {
        return apiFetch('/teams', {
            method: 'POST',
            body: JSON.stringify({ teamName: newTeamData.name, team_leader_id: leaderId, member_user_ids: memberIds }),
        });
    },
    
    updateTeam: async(updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]): Promise<{ team: Team, updatedUsers: User[] }> => {
        return apiFetch(`/teams/${updatedTeam.id}`, {
            method: 'PUT',
            body: JSON.stringify({ teamName: updatedTeam.name, leaderId: newLeaderId, memberIds: newMemberIds })
        });
    },
    
    deleteTeam: async(teamId: string): Promise<{ teamId: string, updatedUsers: User[] }> => {
        return apiFetch(`/teams/${teamId}`, { method: 'DELETE' });
    },

    addUsersToTeam: async (userIds: string[], teamId: string): Promise<User[]> => {
        return apiFetch(`/teams/${teamId}/members`, {
            method: 'POST',
            body: JSON.stringify({ user_ids: userIds })
        });
    },

    removeUserFromTeam: async (userId: string, teamId: string): Promise<User> => {
        return apiFetch(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
    },
};