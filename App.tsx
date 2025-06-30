import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Header from './components/Header';
import KanbanBoard from './components/KanbanBoard';
import TabBar, { Tab } from './components/TabBar';
import { User, Task, FinancialTransaction, Notification, Comment, Project, Team, NotificationPreferences } from './types';
import TimesView from './components/TimesView';
import FinancesView from './components/FinancesView';
import PortfolioView from './components/PortfolioView';
import SettingsView, { ActiveSection } from './components/SettingsView';
import LoginView from './components/LoginView';
import OnboardingModal from './components/OnboardingModal';
import LegalDocumentView from './components/LegalDocumentView';
import { api } from './services/api';
import Spinner from './components/Spinner';

const App: React.FC = () => {
  // Data state, fetched from API
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [financials, setFinancials] = useState<FinancialTransaction[]>([]);
  const [organizationSettings, setOrganizationSettings] = useState({ name: '', logoUrl: '' });
  
  // Auth & UI state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start as true to check for session
  
  const [activeTab, setActiveTab] = useState<Tab>('Portfolio');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const [settingsInitialSection, setSettingsInitialSection] = useState<ActiveSection | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [legalViewContent, setLegalViewContent] = useState<{ title: string; content: string } | null>(null);
  
  // Effect to check for an existing token on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = api.getToken();
      if (token) {
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
              api.clearToken();
          }
        } catch (error) {
          console.error("Session restore failed:", error);
          api.clearToken();
        }
      }
      setIsLoading(false);
    };
    checkAuthStatus();
  }, []);

  const projectsForCurrentUser = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Super Admin') return projects;
    if (currentUser.role === 'Team Leader') return projects.filter(p => p.teamId === currentUser.teamId);
    if (currentUser.role === 'Guest') return projects.filter(p => p.id === currentUser.projectId);
    // Employees don't directly interact with project list, they see tasks from projects they are on.
    const userTaskProjectIds = new Set(tasks.filter(t => t.assigneeIds.includes(currentUser.id)).map(t => t.projectId));
    return projects.filter(p => userTaskProjectIds.has(p.id));
  }, [currentUser, projects, tasks]);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    // When projects for current user change, update selected project if needed
    if(projectsForCurrentUser.length > 0 && !projectsForCurrentUser.find(p => p.id === selectedProjectId)) {
        setSelectedProjectId(projectsForCurrentUser[0].id);
    } else if (projectsForCurrentUser.length === 0) {
        setSelectedProjectId(null);
    }
  }, [projectsForCurrentUser, selectedProjectId]);


  useEffect(() => {
    if (!currentUser) return;
    
    const currentProjects = projectsForCurrentUser;
    if (!currentProjects.find(p => p.id === selectedProjectId)) {
      setSelectedProjectId(currentProjects[0]?.id || null);
    }
    
    const availableTabs: Tab[] = ['משימות', 'זמנים'];
    if(currentUser.role === 'Super Admin') availableTabs.push('Portfolio', 'כספים');
    if(currentUser.role === 'Team Leader') availableTabs.push('כספים');

    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || 'משימות');
    }

  }, [currentUser, projectsForCurrentUser, selectedProjectId, activeTab]);

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
                // Default to true if preferences are not set or user is a guest. Guests can't change prefs.
                const hasPermission = !user?.notificationPreferences || user.notificationPreferences[type] || user.role === 'Guest';
                if (!hasPermission) return false;
                
                // Prevent duplicates
                return !prev.some(p => p.userId === n.userId && p.taskId === n.taskId && p.text === n.text && !p.read);
            });
        
        return [...notificationsToAdd, ...prev];
    });
  }, [users]);


  useEffect(() => {
      const overdueNotifications: Omit<Notification, 'id' | 'timestamp' | 'read'>[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      tasks.forEach(task => {
          const endDate = new Date(task.endDate);
          const teamLeader = getTeamLeaderForTask(task);
          if (endDate < today && task.columnId !== 'col-done' && teamLeader) {
              overdueNotifications.push({
                  userId: teamLeader.id,
                  text: `שימו לב, המשימה "${task.title}" עברה את תאריך היעד.`,
                  taskId: task.id,
              });
          }
      });

      if (overdueNotifications.length > 0) {
          addNotification(overdueNotifications, 'onStatusChange');
      }
  }, [tasks, addNotification, getTeamLeaderForTask]);
  
  const handleUpdateTask = useCallback(async (updatedTask: Task) => {
    if (!currentUser) return;
    const originalTask = tasks.find(t => t.id === updatedTask.id);
    if (!originalTask) return;

    try {
        const returnedTask = await api.updateTask(updatedTask);
        setTasks(prevTasks =>
          prevTasks.map(task => (task.id === returnedTask.id ? returnedTask : task))
        );

        const teamLeader = getTeamLeaderForTask(returnedTask);
        const superAdmins = users.filter(u => u.role === 'Super Admin');

        if (returnedTask.columnId !== originalTask.columnId && (returnedTask.columnId === 'col-done' || returnedTask.columnId === 'col-stuck')) {
            const assignees = users.filter(u => returnedTask.assigneeIds.includes(u.id));
            let notificationText = '';
            if (returnedTask.columnId === 'col-done') {
                notificationText = `${assignees.map(a => a.name).join(', ')} השלים/ה את המשימה: "${returnedTask.title}"`;
            } else {
                notificationText = `❗ משימה תקועה: "${returnedTask.title}". יש לבדוק.`;
            }
            
            const notifications: Omit<Notification, 'id' | 'timestamp' | 'read'>[] = [];
            if(teamLeader) notifications.push({ userId: teamLeader.id, text: notificationText, taskId: returnedTask.id });
            superAdmins.forEach(sa => notifications.push({userId: sa.id, text: notificationText, taskId: returnedTask.id}));
            if(notifications.length > 0) addNotification(notifications, 'onStatusChange');
        }

        if (returnedTask.endDate !== originalTask.endDate) {
            const notifications = returnedTask.assigneeIds.map(userId => ({
                userId: userId,
                text: `תאריך היעד למשימה "${returnedTask.title}" שונה ל-${new Date(returnedTask.endDate).toLocaleDateString('he-IL')}`,
                taskId: returnedTask.id
            }));
            if(notifications.length > 0) addNotification(notifications, 'onDueDateChange');
        }

        const newAssignees = returnedTask.assigneeIds.filter(id => !originalTask.assigneeIds.includes(id));
        if (newAssignees.length > 0) {
            const notifications = newAssignees.map(userId => ({
                userId: userId,
                text: `שויכה לך משימה חדשה: "${returnedTask.title}"`,
                taskId: returnedTask.id
            }));
            addNotification(notifications, 'onAssignment');
        }
    } catch (error) {
        console.error("Failed to update task:", error);
        alert(`שגיאה בעדכון המשימה: ${(error as Error).message}`);
    }
  }, [tasks, addNotification, getTeamLeaderForTask, users, currentUser]);
  
  const handleBulkUpdateTasks = useCallback(async (updatedTasks: Task[], originalTasksMap: Map<string, Task>) => {
    if (!currentUser) return;
    try {
        const returnedTasks = await api.bulkUpdateTasks(updatedTasks);
        const updatedTaskMap = new Map(returnedTasks.map(t => [t.id, t]));
        
        setTasks(prevTasks => 
            prevTasks.map(task => updatedTaskMap.get(task.id) || task)
        );

        let newNotifications: Omit<Notification, 'id' | 'timestamp' | 'read'>[] = [];

        returnedTasks.forEach(updatedTask => {
            const originalTask = originalTasksMap.get(updatedTask.id);
            if (!originalTask) return;

            if (updatedTask.endDate !== originalTask.endDate || updatedTask.startDate !== originalTask.startDate) {
                updatedTask.assigneeIds.forEach(userId => {
                    newNotifications.push({
                        userId: userId,
                        text: `לוח הזמנים למשימה "${updatedTask.title}" השתנה ל-${new Date(updatedTask.startDate).toLocaleDateString('he-IL')} - ${new Date(updatedTask.endDate).toLocaleDateString('he-IL')}`,
                        taskId: updatedTask.id
                    });
                });
            }
        });

        if (newNotifications.length > 0) {
            addNotification(newNotifications, 'onDueDateChange');
        }
    } catch (error) {
        console.error("Failed to bulk update tasks:", error);
        alert(`שגיאה בעדכון מספר משימות: ${(error as Error).message}`);
    }
  }, [addNotification, currentUser]);

  const handleAddTask = useCallback(async (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies' | 'isMilestone'>) => {
    if (!currentUser) return;

    const fullTaskData: Omit<Task, 'id'> = {
        ...taskData,
        columnId: 'col-not-started',
        comments: [],
        plannedCost: 0,
        actualCost: 0,
        dependencies: [],
        isMilestone: false,
        baselineStartDate: undefined,
        baselineEndDate: undefined,
        parentId: undefined,
    };

    try {
        const newTask = await api.addTask(fullTaskData);
        setTasks(prev => [...prev, newTask]);
        
        const newNotifications = taskData.assigneeIds.map(userId => ({
            userId: userId,
            text: `שויכה לך משימה חדשה: "${newTask.title}"`,
            taskId: newTask.id,
        }));

        if (newNotifications.length > 0) {
            addNotification(newNotifications, 'onAssignment');
        }
    } catch (error) {
        console.error("Failed to add task:", error);
        alert(`שגיאה בהוספת משימה: ${(error as Error).message}`);
    }
  }, [addNotification, currentUser]);

  const handleAddComment = useCallback(async (taskId: string, comment: Comment) => {
    if (!currentUser) return;
    try {
        const updatedTask = await api.addComment(taskId, comment);
        setTasks(prevTasks =>
            prevTasks.map(t => (t.id === taskId ? updatedTask : t))
        );

        const newNotifications: Omit<Notification, 'id' | 'timestamp' | 'read'>[] = [];
        const teamLeader = getTeamLeaderForTask(updatedTask);
        const superAdmins = users.filter(u => u.role === 'Super Admin');
        const projectGuests = users.filter(u => u.role === 'Guest' && u.projectId === updatedTask.projectId);
        
        const recipients = new Set(updatedTask.assigneeIds);
        if(teamLeader) recipients.add(teamLeader.id);
        superAdmins.forEach(sa => recipients.add(sa.id));
        projectGuests.forEach(g => recipients.add(g.id));

        recipients.forEach(userId => {
            if (userId !== comment.user.id) { 
                newNotifications.push({
                    userId: userId,
                    text: `${comment.user.name} כתב/ה תגובה חדשה על המשימה: "${updatedTask.title}"`,
                    taskId: updatedTask.id,
                });
            }
        });
        if (newNotifications.length > 0) {
            addNotification(newNotifications, 'onComment');
        }
    } catch (error) {
        console.error("Failed to add comment:", error);
        alert(`שגיאה בהוספת תגובה: ${(error as Error).message}`);
    }
}, [addNotification, getTeamLeaderForTask, users, currentUser]);

const handleAddFinancialTransaction = useCallback(async (transactionData: Omit<FinancialTransaction, 'id'>) => {
    if (!currentUser) return;
    try {
        const newTransaction = await api.addFinancialTransaction(transactionData);
        setFinancials(prev => [newTransaction, ...prev]);
    } catch (error) {
        console.error("Failed to add financial transaction:", error);
        alert(`שגיאה בהוספת רישום כספי: ${(error as Error).message}`);
    }
  }, [currentUser]);
  
  const handleCreateProject = useCallback(async (projectData: Omit<Project, 'id'>) => {
    if (!currentUser) return;
    try {
        const newProject = await api.createProject(projectData);
        setProjects(prev => [newProject, ...prev]);
    } catch (error) {
        console.error("Failed to create project:", error);
        alert(`שגיאה ביצירת פרויקט: ${(error as Error).message}`);
    }
  }, [currentUser]);

  const tasksForView = useMemo(() => {
    if (!currentUser) return [];
    if (!selectedProjectId) {
      if (currentUser.role === 'Employee') return tasks.filter(task => task.assigneeIds.includes(currentUser.id));
      return [];
    }
    const projectTasks = tasks.filter(task => task.projectId === selectedProjectId);
    if (currentUser.role === 'Guest') {
        return projectTasks;
    }
    if (currentUser.role === 'Super Admin' || currentUser.role === 'Team Leader') {
      return projectTasks;
    }
    return projectTasks.filter(task => task.assigneeIds.includes(currentUser.id));
  }, [currentUser, tasks, selectedProjectId]);

  const handleSetNotificationsRead = useCallback((ids: string[]) => {
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? {...n, read: true} : n));
  }, []);

  const handleInviteGuest = useCallback(async (email: string, projectId: string) => {
      if (!currentUser) return;
      try {
          const newGuest = await api.inviteGuest(email, projectId);
          setUsers(prev => [...prev, newGuest]);
      } catch (error) {
          console.error("Failed to invite guest:", error);
          alert(`שגיאה בהזמנת אורח: ${(error as Error).message}`);
      }
  }, [currentUser]);

  const handleRevokeGuest = useCallback(async (guestId: string) => {
      if (!currentUser) return;
      try {
          await api.revokeGuest(guestId);
          setUsers(prev => prev.filter(u => u.id !== guestId));
      } catch (error) {
          console.error("Failed to revoke guest:", error);
          alert(`שגיאה בביטול גישת אורח: ${(error as Error).message}`);
      }
  }, [currentUser]);
  
  const handleGlobalSearch = useCallback((query: string) => {
    if (query.length < 3) return { projects: [], tasks: [], comments: [] };
    const lowerQuery = query.toLowerCase();

    const accessibleProjects = projectsForCurrentUser;
    const accessibleProjectIds = new Set(accessibleProjects.map(p => p.id));

    const foundProjects = accessibleProjects.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery)
    );

    const foundTasks = tasks.filter(t => 
        accessibleProjectIds.has(t.projectId) && (t.title.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery))
    );

    const foundComments = tasks.flatMap(t => t.comments.map(c => ({...c, task: t})))
        .filter(c => 
            accessibleProjectIds.has(c.task.projectId) && c.text.toLowerCase().includes(lowerQuery)
        );
    
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
          console.error("Failed to update user:", error);
          alert(`שגיאה בעדכון משתמש: ${(error as Error).message}`);
      }
  }, [currentUser]);

  const handleCreateUser = useCallback(async (newUserData: Omit<User, 'id' | 'avatarUrl'>) => {
      if (!currentUser) return;
      try {
          const newUser = await api.createUser(newUserData);
          setUsers(prev => [...prev, newUser]);
          alert(`הזמנה נשלחה אל ${newUser.email}. כעת הם יכולים להגדיר סיסמה ולהתחבר.`);
      } catch(error) {
          console.error("Failed to create user:", error);
          alert(`שגיאה ביצירת משתמש: ${(error as Error).message}`);
      }
  }, [currentUser]);

  const handleDeleteUser = useCallback(async (userId: string) => {
      if (!currentUser) return;
      try {
          const disabledUser = await api.deleteUser(userId);
          setUsers(prev => prev.map(u => u.id === userId ? disabledUser : u));
      } catch(error) {
          console.error("Failed to delete user:", error);
          alert(`שגיאה בהשבתת משתמש: ${(error as Error).message}`);
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
          console.error("Failed to update team:", error);
          alert(`שגיאה בעדכון צוות: ${(error as Error).message}`);
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
          console.error("Failed to create team:", error);
          alert(`שגיאה ביצירת צוות: ${(error as Error).message}`);
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
          console.error("Failed to delete team:", error);
          alert(`שגיאה במחיקת צוות: ${(error as Error).message}`);
      }
  }, [currentUser]);

  const handleAddUsersToTeam = useCallback(async (userIds: string[], teamId: string) => {
      if (!currentUser) return;
      try {
          const updatedUsers = await api.addUsersToTeam(userIds, teamId);
          const updatedUsersMap = new Map(updatedUsers.map(u => [u.id, u]));
          setUsers(prev => prev.map(u => updatedUsersMap.get(u.id) || u));
      } catch (error) {
          console.error("Failed to add users to team:", error);
          alert(`שגיאה בהוספת חברים לצוות: ${(error as Error).message}`);
      }
  }, [currentUser]);
  
  const handleRemoveUserFromTeam = useCallback(async (userId: string) => {
      if (!currentUser) return;
      try {
          const updatedUser = await api.removeUserFromTeam(userId);
          setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      } catch (error) {
          console.error("Failed to remove user from team:", error);
          alert(`שגיאה בהסרת חבר מצוות: ${(error as Error).message}`);
      }
  }, [currentUser]);

  const handleToggleSettings = useCallback(() => {
    setView(prev => prev === 'dashboard' ? 'settings' : 'dashboard');
    setSettingsInitialSection(null);
  }, []);
  
  const handleGoToCreateTeam = () => {
    setShowOnboardingModal(false);
    setView('settings');
    setSettingsInitialSection('team-management');
  };

  const handleBackToDashboard = () => {
      setView('dashboard');
      setSettingsInitialSection(null);
  };

  const handleLogin = async (email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
        const user = await api.login(email, password);
        if (user) {
            setCurrentUser(user);
            const initialData = await api.getInitialData();
            setUsers(initialData.users);
            setTeams(initialData.teams);
            setProjects(initialData.projects);
            setTasks(initialData.tasks);
            setFinancials(initialData.financials);
            setOrganizationSettings(initialData.organizationSettings);
            
            setIsAuthenticated(true);
            setView('dashboard');
            
            let initialTab: Tab = 'משימות';
            if (user.role === 'Super Admin') initialTab = 'Portfolio';
            else if(user.role === 'Team Leader') initialTab = 'כספים';
            setActiveTab(initialTab);
            
            setIsLoading(false);
            return null;
        }
        setIsLoading(false);
        return "אימייל או סיסמה שגויים. אנא נסה שוב.";
    } catch(err) {
        setIsLoading(false);
        return (err as Error).message || "שגיאה לא צפויה";
    }
  };

  const handleLogout = () => {
    api.clearToken();
    setCurrentUser(null);
    setIsAuthenticated(false);
    // Clear all data state
    setUsers([]);
    setTeams([]);
    setProjects([]);
    setTasks([]);
    setFinancials([]);
    setNotifications([]);
  };
  
  const handleRegistration = async (registrationData: { fullName: string; email: string; password: string; companyName: string; }): Promise<string | null> => {
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
        
        setView('dashboard');
        setActiveTab('Portfolio');
        setShowOnboardingModal(true);

        return null; // Success
    } catch(err) {
        return (err as Error).message || "שגיאת הרשמה לא צפויה.";
    }
  };
  
  const handleShowLegalDocument = (title: string, content: string) => {
    setLegalViewContent({ title, content });
  };

  const handleHideLegalDocument = () => {
    setLegalViewContent(null);
  };
  
  if (isLoading) {
      return (
          <div className="flex items-center justify-center h-screen bg-light">
              <Spinner className="w-12 h-12 text-accent"/>
          </div>
      )
  }

  if (legalViewContent) {
    return <LegalDocumentView title={legalViewContent.title} content={legalViewContent.content} onBack={handleHideLegalDocument} />;
  }

  if (!isAuthenticated || !currentUser) {
    return <LoginView onLogin={handleLogin} onRegister={handleRegistration} onShowLegalDocument={handleShowLegalDocument} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'Portfolio':
        return currentUser.role === 'Super Admin' ? 
          <PortfolioView 
            allProjects={projects} 
            allTasks={tasks}
            allFinancials={financials}
            allUsers={users}
            allTeams={teams}
            onCreateProject={handleCreateProject}
            onRevokeGuest={handleRevokeGuest}
           /> : null;
      case 'זמנים':
        return <TimesView 
                  tasks={tasksForView} 
                  onUpdateTask={handleUpdateTask} 
                  onBulkUpdateTasks={handleBulkUpdateTasks}
                  onAddComment={handleAddComment} 
                  currentUser={currentUser} 
                  allUsers={users}
                  allProjects={projects}
                  selectedProjectId={selectedProjectId}
                  onInviteGuest={handleInviteGuest}
                />;
      case 'כספים':
        return (currentUser.role === 'Super Admin' || currentUser.role === 'Team Leader') ? 
          <FinancesView
            currentUser={currentUser}
            teams={teams}
            projects={projects}
            allFinancials={financials}
            onAddTransaction={handleAddFinancialTransaction}
            selectedProjectId={selectedProjectId}
            onInviteGuest={handleInviteGuest}
          /> : null;
      case 'משימות':
        return <KanbanBoard 
                  tasks={tasksForView}
                  onUpdateTask={handleUpdateTask}
                  onAddTask={handleAddTask}
                  onAddComment={handleAddComment}
                  currentUser={currentUser}
                  users={users}
                  selectedProjectId={selectedProjectId}
                  allProjects={projects}
                  onInviteGuest={handleInviteGuest}
                />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-light font-sans flex flex-col">
      <Header 
        currentUser={currentUser} 
        onLogout={handleLogout}
        notifications={notifications}
        onSetNotificationsRead={handleSetNotificationsRead}
        projects={projectsForCurrentUser}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onSearch={handleGlobalSearch}
        onGoToSettings={handleToggleSettings}
      />
      {showOnboardingModal && currentUser && (
          <OnboardingModal
              user={currentUser}
              onClose={() => setShowOnboardingModal(false)}
              onGoToCreateTeam={handleGoToCreateTeam}
          />
      )}
      {view === 'dashboard' && <TabBar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />}
      <main className="p-4 sm:p-6 lg:p-8 flex-grow">
        {view === 'dashboard' ? (
            renderContent()
        ) : (
            <SettingsView 
                currentUser={currentUser}
                onUpdateUser={handleUpdateUser}
                onBackToDashboard={handleBackToDashboard}
                allUsers={users}
                teams={teams}
                organizationSettings={organizationSettings}
                onUpdateOrganizationSettings={setOrganizationSettings}
                onCreateUser={handleCreateUser}
                onDeleteUser={handleDeleteUser}
                onUpdateTeam={handleUpdateTeam}
                onCreateTeam={handleCreateTeam}
                onDeleteTeam={handleDeleteTeam}
                onAddUsersToTeam={handleAddUsersToTeam}
                onRemoveUserFromTeam={handleRemoveUserFromTeam}
                initialSection={settingsInitialSection}
            />
        )}
      </main>
    </div>
  );
};

export default App;
