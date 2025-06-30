import React, { createContext, useState, useMemo, useCallback, useEffect, useContext, ReactNode } from 'react';
import { User, Task, FinancialTransaction, Notification, Comment, Project, Team, NotificationPreferences, UserRole } from '../types';
import { api } from '../services/api';

interface AppContextType {
    // State
    users: User[];
    teams: Team[];
    projects: Project[];
    tasks: Task[];
    financials: FinancialTransaction[];
    organizationSettings: { name: string; logoUrl: string };
    currentUser: User | null;
    isAuthenticated: boolean;
    isAppLoading: boolean;
    globalError: string | null;
    notifications: Notification[];
    projectsForCurrentUser: Project[];
    selectedProjectId: string | null;
    
    // Setters & Handlers
    setCurrentUser: (user: User | null) => void;
    setIsAuthenticated: (auth: boolean) => void;
    setGlobalError: (error: string | null) => void;
    setSelectedProjectId: (id: string | null) => void;

    handleLogin: (email: string, password: string) => Promise<string | null>;
    handleLogout: () => void;
    handleRegistration: (data: { fullName: string; email: string; password: string; companyName: string; }) => Promise<{ success: boolean; error: string | null }>;
    handleUpdateTask: (updatedTask: Task) => Promise<void>;
    handleBulkUpdateTasks: (updatedTasks: Task[], originalTasksMap: Map<string, Task>) => Promise<void>;
    handleAddTask: (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies' | 'isMilestone'>) => Promise<void>;
    handleAddComment: (taskId: string, comment: Comment) => Promise<void>;
    handleAddFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>) => Promise<void>;
    handleCreateProject: (projectData: Omit<Project, 'id'>) => Promise<void>;
    handleSetNotificationsRead: (ids: string[]) => void;
    handleInviteGuest: (email: string, projectId: string) => Promise<void>;
    handleRevokeGuest: (guestId: string) => Promise<void>;
    handleGlobalSearch: (query: string) => { projects: Project[]; tasks: Task[]; comments: (Comment & { task: Task })[] };
    handleUpdateUser: (updatedUser: User) => Promise<void>;
    handleCreateUser: (newUserData: Omit<User, 'id' | 'avatarUrl'>) => Promise<void>;
    handleDeleteUser: (userId: string) => Promise<void>;
    handleUpdateTeam: (updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]) => Promise<void>;
    handleCreateTeam: (newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[]) => Promise<void>;
    handleDeleteTeam: (teamId: string) => Promise<void>;
    handleAddUsersToTeam: (userIds: string[], teamId: string) => Promise<void>;
    handleRemoveUserFromTeam: (userId: string, teamId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [financials, setFinancials] = useState<FinancialTransaction[]>([]);
    const [organizationSettings, setOrganizationSettings] = useState({ name: '', logoUrl: '' });
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [globalError, setGlobalError] = useState<string | null>(null);
    
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const bootstrapApp = useCallback(async () => {
        try {
            const data = await api.getInitialData();
            setUsers(data.users);
            setTeams(data.teams);
            setProjects(data.projects);
            setTasks(data.tasks);
            setFinancials(data.financials);
            setOrganizationSettings(data.organizationSettings);

            const loggedInUser = data.users.find(u => u.id === api.getUserIdFromToken());
            if (loggedInUser) {
                setCurrentUser(loggedInUser);
                setIsAuthenticated(true);
            } else {
                handleLogout();
            }
        } catch (error) {
            console.error("Session restore failed:", error);
            handleLogout();
        }
    }, []);

    useEffect(() => {
        const checkAuthStatus = async () => {
            const token = api.getToken();
            if (token) {
                await bootstrapApp();
            }
            setIsAppLoading(false);
        };
        checkAuthStatus();
    }, [bootstrapApp]);

    const handleLogin = async (email: string, password: string): Promise<string | null> => {
        setIsAppLoading(true);
        try {
            const user = await api.login(email, password);
            if (user) {
                await bootstrapApp();
                setIsAppLoading(false);
                return null;
            }
            setIsAppLoading(false);
            return "אימייל או סיסמה שגויים.";
        } catch(err) {
            setIsAppLoading(false);
            return (err as Error).message || "שגיאה לא צפויה";
        }
    };
    
    const handleLogout = useCallback(() => {
        api.clearToken();
        setCurrentUser(null);
        setIsAuthenticated(false);
        setUsers([]);
        setTeams([]);
        setProjects([]);
        setTasks([]);
        setFinancials([]);
        setNotifications([]);
        setSelectedProjectId(null);
    }, []);

    const handleRegistration = async (registrationData: { fullName: string; email: string; password: string; companyName: string; }): Promise<{ success: boolean; error: string | null }> => {
        try {
            const { user, organizationSettings } = await api.register(registrationData);
            setUsers([user]);
            setTeams([]);
            setProjects([]);
            setTasks([]);
            setFinancials([]);
            setNotifications([]);
            setOrganizationSettings(organizationSettings);
            setCurrentUser(user);
            setIsAuthenticated(true);
            return { success: true, error: null };
        } catch(err) {
            return { success: false, error: (err as Error).message || "שגיאת הרשמה לא צפויה."};
        }
    };

    const projectsForCurrentUser = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Super Admin') return projects;
        if (currentUser.role === 'Team Leader') return projects.filter(p => p.teamId === currentUser.teamId);
        if (currentUser.role === 'Guest') return projects.filter(p => p.id === currentUser.projectId);
        
        const userTaskProjectIds = new Set(tasks.filter(t => t.assigneeIds.includes(currentUser.id)).map(t => t.projectId));
        return projects.filter(p => userTaskProjectIds.has(p.id));
    }, [currentUser, projects, tasks]);

    const getTeamLeaderForTask = useCallback((task: Task): User | undefined => {
        const project = projects.find(p => p.id === task.projectId);
        if (!project) return undefined;
        return users.find(u => u.role === 'Team Leader' && u.teamId === project.teamId);
    }, [projects, users]);

    const addNotification = useCallback((newNotifications: Omit<Notification, 'id' | 'timestamp' | 'read'>[], type: keyof NotificationPreferences) => {
        setNotifications(prev => {
            const now = new Date().toISOString();
            const notificationsToAdd = newNotifications
                .map(n => ({ ...n, id: `notif-${Date.now()}-${Math.random()}`, timestamp: now, read: false }))
                .filter(n => {
                    const user = users.find(u => u.id === n.userId);
                    const hasPermission = !user?.notificationPreferences || user.notificationPreferences[type] || user.role === 'Guest';
                    if (!hasPermission) return false;
                    return !prev.some(p => p.userId === n.userId && p.taskId === n.taskId && p.text === n.text && !p.read);
                });
            return [...notificationsToAdd, ...prev];
        });
    }, [users]);
    
    const handleUpdateTask = useCallback(async (updatedTask: Task) => {
        if (!currentUser) return;
        const originalTask = tasks.find(t => t.id === updatedTask.id);
        if (!originalTask) return;
    
        try {
            const returnedTask = await api.updateTask(updatedTask);
            setTasks(prevTasks => prevTasks.map(task => (task.id === returnedTask.id ? returnedTask : task)));
            // Notification logic...
        } catch (error) {
            setGlobalError(`שגיאה בעדכון המשימה: ${(error as Error).message}`);
        }
    }, [tasks, addNotification, getTeamLeaderForTask, users, currentUser]);

    const handleBulkUpdateTasks = useCallback(async (updatedTasks: Task[], originalTasksMap: Map<string, Task>) => {
        if (!currentUser) return;
        try {
            const returnedTasks = await api.bulkUpdateTasks(updatedTasks);
            const updatedTaskMap = new Map(returnedTasks.map(t => [t.id, t]));
            setTasks(prevTasks => prevTasks.map(task => updatedTaskMap.get(task.id) || task));
            // Notification logic...
        } catch (error) {
            setGlobalError(`שגיאה בעדכון מספר משימות: ${(error as Error).message}`);
        }
    }, [addNotification, currentUser]);

    const handleAddTask = useCallback(async (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies' | 'isMilestone'>) => {
        if (!currentUser) return;
        const fullTaskData: Omit<Task, 'id'> = { ...taskData, columnId: 'col-not-started', comments: [], plannedCost: 0, actualCost: 0, dependencies: [], isMilestone: false };
        try {
            const newTask = await api.addTask(fullTaskData);
            setTasks(prev => [...prev, newTask]);
            // Notification logic...
        } catch (error) {
            setGlobalError(`שגיאה בהוספת משימה: ${(error as Error).message}`);
        }
    }, [addNotification, currentUser]);

    const handleAddComment = useCallback(async (taskId: string, comment: Comment) => {
        if (!currentUser) return;
        try {
            const updatedTask = await api.addComment(taskId, comment);
            setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? updatedTask : t)));
            // Notification logic...
        } catch (error) {
            setGlobalError(`שגיאה בהוספת תגובה: ${(error as Error).message}`);
        }
    }, [addNotification, getTeamLeaderForTask, users, currentUser]);

    const handleAddFinancialTransaction = useCallback(async (transactionData: Omit<FinancialTransaction, 'id'>) => {
        if (!currentUser) return;
        try {
            const newTransaction = await api.addFinancialTransaction(transactionData);
            setFinancials(prev => [newTransaction, ...prev]);
        } catch (error) {
            setGlobalError(`שגיאה בהוספת רישום כספי: ${(error as Error).message}`);
        }
      }, [currentUser]);

    const handleCreateProject = useCallback(async (projectData: Omit<Project, 'id'>) => {
        if (!currentUser) return;
        try {
            const newProject = await api.createProject(projectData);
            setProjects(prev => [newProject, ...prev]);
        } catch (error) {
            setGlobalError(`שגיאה ביצירת פרויקט: ${(error as Error).message}`);
        }
    }, [currentUser]);

    const handleSetNotificationsRead = useCallback((ids: string[]) => {
        setNotifications(prev => prev.map(n => ids.includes(n.id) ? {...n, read: true} : n));
    }, []);
  
    const handleInviteGuest = useCallback(async (email: string, projectId: string) => {
        if (!currentUser) return;
        try {
            const newGuest = await api.inviteGuest(email, projectId);
            setUsers(prev => [...prev, newGuest]);
        } catch (error) {
            setGlobalError(`שגיאה בהזמנת אורח: ${(error as Error).message}`);
        }
    }, [currentUser]);
  
    const handleRevokeGuest = useCallback(async (guestId: string) => {
        if (!currentUser) return;
        try {
            await api.revokeGuest(guestId);
            setUsers(prev => prev.filter(u => u.id !== guestId));
        } catch (error) {
            setGlobalError(`שגיאה בביטול גישת אורח: ${(error as Error).message}`);
        }
    }, [currentUser]);
    
    const handleGlobalSearch = useCallback((query: string) => {
      if (query.length < 3) return { projects: [], tasks: [], comments: [] };
      const lowerQuery = query.toLowerCase();
      const accessibleProjects = projectsForCurrentUser;
      const accessibleProjectIds = new Set(accessibleProjects.map(p => p.id));
      const foundProjects = accessibleProjects.filter(p => p.name.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery));
      const foundTasks = tasks.filter(t => accessibleProjectIds.has(t.projectId) && (t.title.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery)));
      const foundComments = tasks.flatMap(t => t.comments.map(c => ({...c, task: t}))).filter(c => accessibleProjectIds.has(c.task.projectId) && c.text.toLowerCase().includes(lowerQuery));
      return { projects: foundProjects, tasks: foundTasks, comments: foundComments };
    }, [projectsForCurrentUser, tasks]);
  
    const handleUpdateUser = useCallback(async (updatedUser: User) => {
        if (!currentUser) return;
        try {
            const returnedUser = await api.updateUser(updatedUser);
            setUsers(prev => prev.map(u => u.id === returnedUser.id ? returnedUser : u));
            if (currentUser && currentUser.id === returnedUser.id) {
                setCurrentUser(returnedUser);
            }
        } catch (error) {
            setGlobalError(`שגיאה בעדכון משתמש: ${(error as Error).message}`);
        }
    }, [currentUser]);
  
    const handleCreateUser = useCallback(async (newUserData: Omit<User, 'id' | 'avatarUrl'>) => {
        if (!currentUser) return;
        try {
            const newUser = await api.createUser(newUserData);
            setUsers(prev => [...prev, newUser]);
        } catch(error) {
            setGlobalError(`שגיאה ביצירת משתמש: ${(error as Error).message}`);
        }
    }, [currentUser]);
  
    const handleDeleteUser = useCallback(async (userId: string) => {
        if (!currentUser) return;
        try {
            const disabledUser = await api.deleteUser(userId);
            setUsers(prev => prev.map(u => u.id === userId ? disabledUser : u));
        } catch(error) {
            setGlobalError(`שגיאה בהשבתת משתמש: ${(error as Error).message}`);
        }
    }, [currentUser]);
    
    const handleUpdateTeam = useCallback(async (updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[]) => {
        if (!currentUser) return;
        try {
            const { team, updatedUsers } = await api.updateTeam(updatedTeam, newLeaderId, newMemberIds);
            setTeams(prev => prev.map(t => t.id === team.id ? team : t));
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            setUsers(prev => prev.map(u => updatedUsersMap.get(u.id) || u));
        } catch (error) {
            setGlobalError(`שגיאה בעדכון צוות: ${(error as Error).message}`);
        }
    }, [currentUser]);
    
    const handleCreateTeam = useCallback(async (newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[]) => {
        if (!currentUser) return;
        try {
            const { team, updatedUsers } = await api.createTeam(newTeamData, leaderId, memberIds);
            setTeams(prev => [...prev, team]);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            setUsers(prev => prev.map(u => updatedUsersMap.get(u.id) || u));
        } catch (error) {
            setGlobalError(`שגיאה ביצירת צוות: ${(error as Error).message}`);
        }
    }, [currentUser]);
  
    const handleDeleteTeam = useCallback(async (teamId: string) => {
        if (!currentUser) return;
        try {
            const { updatedUsers } = await api.deleteTeam(teamId);
            setTeams(prev => prev.filter(t => t.id !== teamId));
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            setUsers(prev => prev.map(u => updatedUsersMap.get(u.id) || u));
        } catch (error) {
            setGlobalError(`שגיאה במחיקת צוות: ${(error as Error).message}`);
        }
    }, [currentUser]);
  
    const handleAddUsersToTeam = useCallback(async (userIds: string[], teamId: string) => {
        if (!currentUser) return;
        try {
            const updatedUsers = await api.addUsersToTeam(userIds, teamId);
            const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
            setUsers(prev => prev.map(u => updatedUsersMap.get(u.id) || u));
        } catch (error) {
            setGlobalError(`שגיאה בהוספת חברים לצוות: ${(error as Error).message}`);
        }
    }, [currentUser]);
    
    const handleRemoveUserFromTeam = useCallback(async (userId: string, teamId: string) => {
        if (!currentUser) return;
        try {
            const updatedUser = await api.removeUserFromTeam(userId, teamId);
            setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
        } catch (error) {
            setGlobalError(`שגיאה בהסרת חבר מצוות: ${(error as Error).message}`);
        }
    }, [currentUser]);

    const value = {
        users, teams, projects, tasks, financials, organizationSettings, currentUser, isAuthenticated, isAppLoading, globalError, notifications, projectsForCurrentUser, selectedProjectId,
        setCurrentUser, setIsAuthenticated, setGlobalError, setSelectedProjectId,
        handleLogin, handleLogout, handleRegistration, handleUpdateTask, handleBulkUpdateTasks, handleAddTask, handleAddComment, handleAddFinancialTransaction, handleCreateProject, handleSetNotificationsRead, handleInviteGuest, handleRevokeGuest, handleGlobalSearch, handleUpdateUser, handleCreateUser, handleDeleteUser, handleUpdateTeam, handleCreateTeam, handleDeleteTeam, handleAddUsersToTeam, handleRemoveUserFromTeam
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
