import { User, Task, Project, Team, FinancialTransaction, Comment } from '../types';

// --- DATABASE SCHEMA IMPLEMENTATION ---

// Raw DB types that match the schema
interface DbTask {
  id: string;
  title: string;
  description: string;
  columnId: string;
  startDate: string;
  endDate: string;
  plannedCost: number;
  actualCost: number;
  baselineStartDate?: string;
  baselineEndDate?: string;
  projectId: string;
  isMilestone?: boolean;
  parentId?: string;
}

interface DbTeam extends Omit<Team, 'leaderId'> {
    id: string;
    name: string;
    leaderId?: string;
}

interface DbComment {
    id: string;
    userId: string;
    text: string;
    timestamp: string;
    taskId: string;
    parentId?: string;
}

interface TaskAssignee {
    task_id: string;
    user_id: string;
}

interface TaskDependency {
    source_task_id: string;
    target_task_id: string;
}

// --- INITIAL DATABASE DATA ---

const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'אלכס דותן', email: 'alex.doe@example.com', password: 'password123', avatarUrl: 'https://i.pravatar.cc/150?u=u1', role: 'Super Admin', notificationPreferences: { onAssignment: true, onComment: true, onStatusChange: true, onDueDateChange: true } },
  { id: 'u2', name: "ג'יין סמית", email: 'jane.smith@example.com', password: 'password123', avatarUrl: 'https://i.pravatar.cc/150?u=u2', role: 'Team Leader', teamId: 'team-dev', notificationPreferences: { onAssignment: true, onComment: true, onStatusChange: true, onDueDateChange: true } },
  { id: 'u3', name: 'סם וילסון', email: 'sam.wilson@example.com', password: 'password123', avatarUrl: 'https://i.pravatar.cc/150?u=u3', role: 'Employee', teamId: 'team-dev', notificationPreferences: { onAssignment: true, onComment: false, onStatusChange: false, onDueDateChange: true } },
  { id: 'u4', name: 'מריה גרסיה', email: 'maria.garcia@example.com', password: 'password123', avatarUrl: 'https://i.pravatar.cc/150?u=u4', role: 'Employee', teamId: 'team-dev', notificationPreferences: { onAssignment: true, onComment: false, onStatusChange: false, onDueDateChange: true } },
  { id: 'u5', name: 'דוד חן', email: 'david.chen@example.com', password: 'password123', avatarUrl: 'https://i.pravatar.cc/150?u=u5', role: 'Team Leader', teamId: 'team-mkt', notificationPreferences: { onAssignment: true, onComment: true, onStatusChange: true, onDueDateChange: true } },
  { id: 'u6', name: 'אמילי לב', email: 'emily.white@example.com', password: 'password123', avatarUrl: 'https://i.pravatar.cc/150?u=u6', role: 'Employee', teamId: 'team-mkt', notificationPreferences: { onAssignment: true, onComment: false, onStatusChange: false, onDueDateChange: true } },
];

const INITIAL_TEAMS: DbTeam[] = [
    { id: 'team-dev', name: 'צוות פיתוח', leaderId: 'u2' },
    { id: 'team-mkt', name: 'צוות שיווק', leaderId: 'u5' },
];

const INITIAL_PROJECTS: Project[] = [
    { id: 'proj-alpha', name: 'פרויקט אלפא', teamId: 'team-dev', budget: 50000, description: 'פרויקט פיתוח ליבת האפליקציה, התמקדות בשירותי צד-שרת.', startDate: d(-30), endDate: d(60) },
    { id: 'proj-beta', name: 'פרויקט בטא', teamId: 'team-dev', budget: 75000, description: 'שדרוג תשתית למעבר לארכיטקטורת ענן סקיילבילית.', startDate: d(0), endDate: d(90) },
    { id: 'proj-gamma', name: 'פרויקט גמא', teamId: 'team-mkt', budget: 25000, description: 'קמפיין שיווקי לרבעון השלישי להגברת רכישת משתמשים.', startDate: d(-15), endDate: d(45) },
];

const INITIAL_FINANCIAL_DATA: FinancialTransaction[] = [
    { id: 'f1', type: 'Income', date: d(-20), source: 'לקוח א\'', description: 'מקדמה ראשונית לפרויקט', amount: 10000, projectId: 'proj-alpha' },
    { id: 'f2', type: 'Expense', date: d(-18), source: 'שירותי ענן בע"מ', description: 'אירוח שרתים לרבעון 1', amount: 300, projectId: 'proj-alpha' },
    { id: 'f3', type: 'Expense', date: d(-15), source: "ג'יין סמית", description: 'משכורת - ינואר', amount: 2000, projectId: 'proj-alpha' },
    { id: 'f4', type: 'Expense', date: d(-10), source: 'קמפיין AdWords', description: 'הוצאות שיווק רבעון 1', amount: 3500, projectId: 'proj-gamma' },
    { id: 'f5', type: 'Income', date: d(-5), source: 'לקוח ב\'', description: 'תשלום אבן דרך 1', amount: 25000, projectId: 'proj-beta' },
];

// This is the old Task structure, which we'll decompose into our new DB tables
const RAW_TASKS_DEPRECATED: Task[] = [
  { id: 't1', title: 'תכנון לשנה הבאה', description: 'יצירת מוקאפים ואבות טיפוס לדף הנחיתה השיווקי החדש באמצעות Figma.', assigneeIds: ['u6'], columnId: 'col-in-progress', startDate: d(-10), endDate: d(-5), plannedCost: 2000, actualCost: 500, dependencies: [], comments: [ { id: 'c1', user: INITIAL_USERS[4], text: 'טיוטה ראשונית מוכנה לבדיקה.', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() }, { id: 'c2', user: INITIAL_USERS[5], text: 'נראה מעולה! אפשר לנסות סכמת צבעים שונה לכפתור ה-CTA?', timestamp: new Date(Date.now() - 86400000).toISOString() }, { id: 'c9', user: INITIAL_USERS[4], text: 'רעיון טוב. אעבוד על כמה חלופות.', parentId: 'c2', timestamp: new Date().toISOString() }, ], projectId: 'proj-gamma' },
  { id: 't2', title: 'הקצאת משאבים', description: 'הטמעת אימות מבוסס JWT עבור ה-API הראשי של האפליקציה.', assigneeIds: ['u3', 'u4'], columnId: 'col-started', startDate: d(-4), endDate: d(2), plannedCost: 5000, actualCost: 2800, dependencies: [], comments: [ { id: 'c3', user: INITIAL_USERS[1], text: 'נקודות הקצה בצד השרת מוכנות. צריך אינטגרציה עם צד הלקוח.', timestamp: new Date(Date.now() - 3600000).toISOString() }, ], projectId: 'proj-gamma', parentId: 't1', },
  { id: 't3', title: 'עדכון הסכם קבלן', description: 'הגדרת GitHub Actions לבנייה, בדיקה ופריסה אוטומטית של האפליקציה.', assigneeIds: ['u3'], columnId: 'col-in-progress', startDate: d(-8), endDate: d(-3), plannedCost: 1500, actualCost: 1500, dependencies: [], comments: [], projectId: 'proj-gamma', parentId: 't1' },
  { id: 't4', title: 'איך לנהל תכנון אירוע', description: 'תיעוד כל נקודות הקצה הציבוריות של ה-API באמצעות Swagger/OpenAPI.', assigneeIds: ['u4'], columnId: 'col-not-started', startDate: d(4), endDate: d(10), plannedCost: 1800, actualCost: 1800, dependencies: ['t3'], comments: [ { id: 'c4', user: INITIAL_USERS[3], text: 'איזו גרסה של ה-API לתעד קודם?', timestamp: new Date(Date.now() - 172800000).toISOString() }, { id: 'c5', user: INITIAL_USERS[1], text: 'בבקשה תתחילי עם v2. אנחנו מוציאים את v1 משימוש בקרוב.', timestamp: new Date(Date.now() - 86400000).toISOString() }, ], projectId: 'proj-gamma' },
  { id: 't5', title: 'סגירת היקף הפרויקט', description: 'טיפול בבעיות עיצוב רספונסיבי בלוח המחוונים למסכים מתחת ל-768px.', assigneeIds: ['u4'], columnId: 'col-in-progress', startDate: d(2), endDate: d(6), plannedCost: 800, actualCost: 0, dependencies: [], comments: [ { id: 'c10', user: INITIAL_USERS[3], text: 'אני תקועה על זה, רכיב הפוטר לא מוצג נכון בספארי ב-iOS.', timestamp: new Date().toISOString() }, ], projectId: 'proj-gamma' },
  { id: 't6', title: 'פגישת פתיחה עם לקוח', description: 'פגישה ראשונית עם בעלי העניין מצד הלקוח להגדרת היקף הפרויקט.', assigneeIds: ['u2', 'u5'], columnId: 'col-done', startDate: d(-25), endDate: d(-25), plannedCost: 0, actualCost: 0, dependencies: [], comments: [], projectId: 'proj-alpha', isMilestone: true, },
  { id: 't7', title: 'ריענון אתר החברה', description: 'פריסה סופית של כל הפיצ\'רים לסביבת הייצור.', assigneeIds: ['u2'], columnId: 'col-in-progress', startDate: d(10), endDate: d(18), plannedCost: 1000, actualCost: 0, dependencies: [], comments: [], projectId: 'proj-gamma' },
  { id: 't8', title: 'עדכון יעדים מרכזיים', description: 'עדכון יעדים בהתבסס על ההיקף החדש.', assigneeIds: ['u5'], columnId: 'col-not-started', startDate: d(7), endDate: d(12), plannedCost: 1000, actualCost: 0, dependencies: ['t5'], comments: [], projectId: 'proj-gamma' },
  { id: 't9', title: 'הקמת DB וסכמה ראשונית', description: 'הקמת מסד נתונים Postgres והחלת מיגרציות סכמה ראשוניות.', assigneeIds: ['u3'], columnId: 'col-done', startDate: d(-28), endDate: d(-25), plannedCost: 1200, actualCost: 1200, dependencies: ['t6'], comments: [], projectId: 'proj-alpha' },
];

const decomposeTasks = (rawTasks: Task[]) => {
    return rawTasks.reduce((acc, task) => {
        const { comments, assigneeIds, dependencies, ...restOfTask } = task;
        
        acc.tasks.push(restOfTask as DbTask);
        
        task.comments.forEach(comment => {
            acc.comments.push({
                id: comment.id,
                userId: comment.user.id,
                text: comment.text,
                timestamp: comment.timestamp,
                taskId: task.id,
                parentId: comment.parentId
            });
        });

        assigneeIds.forEach(userId => {
            acc.task_assignees.push({ task_id: task.id, user_id: userId });
        });

        dependencies.forEach(depId => {
            acc.task_dependencies.push({ source_task_id: depId, target_task_id: task.id });
        });

        return acc;
    }, { tasks: [] as DbTask[], comments: [] as DbComment[], task_assignees: [] as TaskAssignee[], task_dependencies: [] as TaskDependency[] });
};

const initialDecomposedData = decomposeTasks(RAW_TASKS_DEPRECATED);

// This is our simulated database, conforming to the new schema
let db = {
    users: [...INITIAL_USERS],
    teams: [...INITIAL_TEAMS],
    projects: [...INITIAL_PROJECTS],
    tasks: initialDecomposedData.tasks,
    financial_entries: [...INITIAL_FINANCIAL_DATA],
    comments: initialDecomposedData.comments,
    task_assignees: initialDecomposedData.task_assignees,
    task_dependencies: initialDecomposedData.task_dependencies
};

// --- API LAYER ---

const simulateDelay = (ms: number = 150) => new Promise(resolve => setTimeout(resolve, ms));

const _getTaskViewModel = (dbTask: DbTask): Task => {
    const assignees = db.task_assignees
        .filter(a => a.task_id === dbTask.id)
        .map(a => a.user_id);

    const dependencies = db.task_dependencies
        .filter(d => d.target_task_id === dbTask.id)
        .map(d => d.source_task_id);

    const comments = db.comments
        .filter(c => c.taskId === dbTask.id)
        .map(c => {
            const user = db.users.find(u => u.id === c.userId);
            return {
                id: c.id,
                text: c.text,
                timestamp: c.timestamp,
                user: user!,
                parentId: c.parentId,
            } as Comment;
        });

    return {
        ...dbTask,
        assigneeIds: assignees,
        dependencies,
        comments,
    };
};

export const api = {
    login: async (email: string, password: string): Promise<User | null> => {
        await simulateDelay(300);
        const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && !u.disabled);
        return user ? { ...user } : null;
    },

    register: async (data: { fullName: string; email: string; password: string; companyName: string; }): Promise<{ user: User, organizationSettings: { name: string, logoUrl: string } }> => {
        await simulateDelay(500);
        if (db.users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
            throw new Error("משתמש עם כתובת אימייל זו כבר קיים.");
        }
        const newAdmin: User = {
            id: `u-reg-${Date.now()}`,
            name: data.fullName,
            email: data.email,
            password: data.password,
            avatarUrl: `https://i.pravatar.cc/150?u=${data.email}`,
            role: 'Super Admin',
            notificationPreferences: { onAssignment: true, onComment: true, onStatusChange: true, onDueDateChange: true }
        };

        db = {
            users: [newAdmin],
            teams: [],
            projects: [],
            tasks: [],
            financial_entries: [],
            comments: [],
            task_assignees: [],
            task_dependencies: []
        };
        const organizationSettings = { name: data.companyName, logoUrl: '' };
        return { user: newAdmin, organizationSettings };
    },

    getInitialData: async (): Promise<{users: User[], teams: Team[], projects: Project[], tasks: Task[], financials: FinancialTransaction[]}> => {
        await simulateDelay(400);
        const tasksForFrontend = db.tasks.map(t => _getTaskViewModel(t));
        return JSON.parse(JSON.stringify({
            users: db.users,
            teams: db.teams,
            projects: db.projects,
            tasks: tasksForFrontend,
            financials: db.financial_entries,
        }));
    },
    
    updateTask: async (updatedTask: Task, currentUser: User): Promise<Task> => {
        await simulateDelay();
        const project = db.projects.find(p => p.id === updatedTask.projectId);
        if (!project) throw new Error("Project not found");

        const isSuperAdmin = currentUser.role === 'Super Admin';
        const isTeamLeader = currentUser.role === 'Team Leader' && currentUser.teamId === project.teamId;
        const isAssignee = updatedTask.assigneeIds.includes(currentUser.id);
        if (!isSuperAdmin && !isTeamLeader && !isAssignee) {
            throw new Error("Unauthorized: אין לך הרשאה לעדכן משימה זו.");
        }

        const taskIndex = db.tasks.findIndex(t => t.id === updatedTask.id);
        if (taskIndex > -1) {
            const { comments, assigneeIds, dependencies, ...coreTask } = updatedTask;
            db.tasks[taskIndex] = coreTask;

            db.task_assignees = db.task_assignees.filter(a => a.task_id !== updatedTask.id);
            assigneeIds.forEach(uid => db.task_assignees.push({ task_id: updatedTask.id, user_id: uid }));
            
            return _getTaskViewModel(coreTask);
        }
        throw new Error("Task not found");
    },
    
    bulkUpdateTasks: async (updatedTasks: Task[], currentUser: User): Promise<Task[]> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Team Leader') {
            throw new Error("Unauthorized: אין לך הרשאה לעדכן משימות באופן גורף.");
        }
        
        updatedTasks.forEach(updatedTask => {
            const taskIndex = db.tasks.findIndex(t => t.id === updatedTask.id);
            if (taskIndex > -1) {
                const { comments, assigneeIds, dependencies, ...coreTask } = updatedTask;
                db.tasks[taskIndex] = coreTask;
                db.task_dependencies = db.task_dependencies.filter(d => d.target_task_id !== updatedTask.id);
                dependencies.forEach(depId => db.task_dependencies.push({ source_task_id: depId, target_task_id: updatedTask.id }));
            }
        });
        
        return updatedTasks.map(t => _getTaskViewModel(db.tasks.find(dbt => dbt.id === t.id)!));
    },

    addTask: async (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies' | 'isMilestone'>, currentUser: User): Promise<Task> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Team Leader') {
            throw new Error("Unauthorized: רק מנהלים וראשי צוותים יכולים להוסיף משימות.");
        }
        
        const { assigneeIds, ...restOfTaskData } = taskData;
        const newDbTask: DbTask = {
            id: `t-${Date.now()}`,
            ...restOfTaskData,
            isMilestone: false,
            columnId: 'col-not-started',
            plannedCost: 0,
            actualCost: 0,
        };
        db.tasks.push(newDbTask);
        assigneeIds.forEach(uid => db.task_assignees.push({ task_id: newDbTask.id, user_id: uid }));

        return _getTaskViewModel(newDbTask);
    },

    addComment: async(taskId: string, comment: Comment, currentUser: User): Promise<Task> => {
        await simulateDelay();
        const task = db.tasks.find(t => t.id === taskId);
        if (!task) throw new Error("Task not found");
        const project = db.projects.find(p => p.id === task.projectId);
        if(!project) throw new Error("Project not found");

        const isSuperAdmin = currentUser.role === 'Super Admin';
        const isTeamLeader = currentUser.role === 'Team Leader' && currentUser.teamId === project.teamId;
        const isAssignee = db.task_assignees.some(a => a.task_id === taskId && a.user_id === currentUser.id);
        const isGuest = currentUser.role === 'Guest' && currentUser.projectId === project.id;
        if(!isSuperAdmin && !isTeamLeader && !isAssignee && !isGuest) {
            throw new Error("Unauthorized: אין לך הרשאה להוסיף תגובה.");
        }

        const newDbComment: DbComment = {
            id: comment.id,
            userId: comment.user.id,
            taskId: taskId,
            text: comment.text,
            timestamp: comment.timestamp,
            parentId: comment.parentId
        };
        db.comments.push(newDbComment);
        
        return _getTaskViewModel(task);
    },
    
    addFinancialTransaction: async(transactionData: Omit<FinancialTransaction, 'id'>, currentUser: User): Promise<FinancialTransaction> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Team Leader') {
            throw new Error("Unauthorized: אין לך הרשאה להוסיף רישומים כספיים.");
        }
        const newTransaction: FinancialTransaction = {
          id: `f-${Date.now()}`,
          ...transactionData,
        };
        db.financial_entries.unshift(newTransaction);
        return { ...newTransaction };
    },

    createProject: async(projectData: Omit<Project, 'id'>, currentUser: User): Promise<Project> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin') {
            throw new Error("Unauthorized: רק מנהלי מערכת יכולים ליצור פרויקטים חדשים.");
        }
        const newProject: Project = {
          id: `proj-${Date.now()}`,
          ...projectData
        };
        db.projects.unshift(newProject);
        return { ...newProject };
    },

    inviteGuest: async(email: string, projectId: string, currentUser: User): Promise<User> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Team Leader') {
            throw new Error("Unauthorized: רק מנהלים וראשי צוותים יכולים להזמין אורחים.");
        }
        const guestName = email.split('@')[0];
        const newGuest: User = {
            id: `u-guest-${Date.now()}`,
            name: guestName.charAt(0).toUpperCase() + guestName.slice(1),
            email: email,
            password: `guest-${Date.now()}`,
            avatarUrl: `https://i.pravatar.cc/150?u=${email}`,
            role: 'Guest',
            projectId: projectId,
            notificationPreferences: { onAssignment: true, onComment: true, onStatusChange: true, onDueDateChange: true },
        };
        db.users.push(newGuest);
        return { ...newGuest };
    },

    revokeGuest: async(guestId: string, currentUser: User): Promise<string> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin') {
            throw new Error("Unauthorized: רק מנהלי מערכת יכולים לבטל גישת אורחים.");
        }
        db.users = db.users.filter(u => u.id !== guestId);
        return guestId;
    },
    
    updateUser: async(updatedUser: User, currentUser: User): Promise<User> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin' && currentUser.id !== updatedUser.id) {
            throw new Error("Unauthorized: אין לך הרשאה לעדכן משתמש זה.");
        }
        db.users = db.users.map(u => u.id === updatedUser.id ? updatedUser : u);
        return { ...updatedUser };
    },

    createUser: async (newUserData: Omit<User, 'id' | 'avatarUrl'>, currentUser: User): Promise<User> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin') {
            throw new Error("Unauthorized: רק מנהלי מערכת יכולים ליצור משתמשים.");
        }
        const newUser: User = {
          ...newUserData,
          id: `u-${Date.now()}`,
          avatarUrl: `https://i.pravatar.cc/150?u=${newUserData.email}`,
          notificationPreferences: { onAssignment: true, onComment: true, onStatusChange: true, onDueDateChange: true }
        };
        db.users.push(newUser);
        return { ...newUser };
    },

    deleteUser: async(userId: string, currentUser: User): Promise<User> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin') {
            throw new Error("Unauthorized: רק מנהלי מערכת יכולים להשבית משתמשים.");
        }
        const userIndex = db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) throw new Error("User not found");
        db.users[userIndex].disabled = true;
        return { ...db.users[userIndex] };
    },
    
    createTeam: async(newTeamData: Omit<Team, 'id'>, leaderId: string, memberIds: string[], currentUser: User): Promise<{ team: Team, updatedUsers: User[] }> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin') throw new Error("Unauthorized: רק מנהלי מערכת יכולים ליצור צוותים.");
        
        const newTeam: DbTeam = { ...newTeamData, id: `team-${Date.now()}`, leaderId: leaderId };
        db.teams.push(newTeam);
        
        const usersToAssign = new Set([leaderId, ...memberIds]);
        const updatedUsers: User[] = [];
        db.users = db.users.map(u => {
            if (usersToAssign.has(u.id)) {
                const updatedU = { ...u, teamId: newTeam.id };
                updatedUsers.push(updatedU);
                return updatedU;
            }
            return u;
        });
        return { team: newTeam, updatedUsers: JSON.parse(JSON.stringify(updatedUsers)) };
    },
    
    updateTeam: async(updatedTeam: Team, newLeaderId: string | null, newMemberIds: string[], currentUser: User): Promise<{ team: Team, updatedUsers: User[] }> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin') throw new Error("Unauthorized: רק מנהלי מערכת יכולים לעדכן צוותים.");

        const teamIndex = db.teams.findIndex(t => t.id === updatedTeam.id);
        if (teamIndex === -1) throw new Error("Team not found");
        db.teams[teamIndex] = {...db.teams[teamIndex], name: updatedTeam.name, leaderId: newLeaderId || undefined };

        const newTotalMemberIds = new Set([...newMemberIds, ...(newLeaderId ? [newLeaderId] : [])]);
        const updatedUsers: User[] = [];

        db.users = db.users.map(user => {
            const wasInThisTeam = user.teamId === updatedTeam.id;
            const shouldBeInThisTeam = newTotalMemberIds.has(user.id);
            if (shouldBeInThisTeam && user.teamId !== updatedTeam.id) {
                const updatedUser = { ...user, teamId: updatedTeam.id };
                updatedUsers.push(updatedUser);
                return updatedUser;
            }
            if (!shouldBeInThisTeam && wasInThisTeam) {
                const updatedUser = { ...user, teamId: undefined };
                updatedUsers.push(updatedUser);
                return updatedUser;
            }
            return user;
        });

        return { team: db.teams[teamIndex], updatedUsers: JSON.parse(JSON.stringify(updatedUsers)) };
    },
    
    deleteTeam: async(teamId: string, currentUser: User): Promise<{ teamId: string, updatedUsers: User[] }> => {
        await simulateDelay();
        if (currentUser.role !== 'Super Admin') throw new Error("Unauthorized: רק מנהלי מערכת יכולים למחוק צוותים.");

        db.teams = db.teams.filter(t => t.id !== teamId);
        const updatedUsers: User[] = [];
        db.users = db.users.map(u => {
            if (u.teamId === teamId) {
                const updatedU = { ...u, teamId: undefined };
                updatedUsers.push(updatedU);
                return updatedU;
            }
            return u;
        });
        return { teamId, updatedUsers: JSON.parse(JSON.stringify(updatedUsers)) };
    },

    addUsersToTeam: async (userIds: string[], teamId: string, currentUser: User): Promise<User[]> => {
        await simulateDelay();
        const team = db.teams.find(t => t.id === teamId);
        if (!team) throw new Error("Team not found");
        if (currentUser.role !== 'Super Admin' && (currentUser.role !== 'Team Leader' || currentUser.teamId !== teamId)) {
            throw new Error("Unauthorized: אין לך הרשאה להוסיף חברים לצוות זה.");
        }

        const updatedUsers: User[] = [];
        db.users = db.users.map(u => {
            if(userIds.includes(u.id)) {
                const updatedU = { ...u, teamId };
                updatedUsers.push(updatedU);
                return updatedU;
            }
            return u;
        });
        return JSON.parse(JSON.stringify(updatedUsers));
    },

    removeUserFromTeam: async (userId: string, currentUser: User): Promise<User> => {
        await simulateDelay();
        const userToRemove = db.users.find(u => u.id === userId);
        if(!userToRemove) throw new Error("User not found");
        if (currentUser.role !== 'Super Admin' && (currentUser.role !== 'Team Leader' || currentUser.teamId !== userToRemove.teamId)) {
            throw new Error("Unauthorized: אין לך הרשאה להסיר חברים מצוות זה.");
        }

        const userIndex = db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) throw new Error("User not found");
        const updatedUser = { ...db.users[userIndex], teamId: undefined };
        db.users[userIndex] = updatedUser;
        return { ...updatedUser };
    },
};
