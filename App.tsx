import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';
import KanbanBoard from './components/KanbanBoard';
import TabBar, { Tab } from './components/TabBar';
import TimesView from './components/TimesView';
import FinancesView from './components/FinancesView';
import PortfolioView from './components/PortfolioView';
import SettingsView, { ActiveSection } from './components/SettingsView';
import LoginView from './components/LoginView';
import OnboardingModal from './components/OnboardingModal';
import LegalDocumentView from './components/LegalDocumentView';
import { useAppContext } from './components/AppContext';
import Spinner from './components/Spinner';
import Toast from './components/Toast';

const App: React.FC = () => {
  const {
    currentUser,
    isAuthenticated,
    isAppLoading,
    projects,
    tasks,
    teams,
    users,
    financials,
    organizationSettings,
    projectsForCurrentUser,
    selectedProjectId,
    setSelectedProjectId,
    handleLogin,
    handleLogout,
    handleRegistration,
    notifications,
    handleSetNotificationsRead,
    handleGlobalSearch,
    globalError,
    setGlobalError
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<Tab>('Portfolio');
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const [settingsInitialSection, setSettingsInitialSection] = useState<ActiveSection | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [legalViewContent, setLegalViewContent] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    // When projects for current user change, update selected project if needed
    if(projectsForCurrentUser.length > 0 && !projectsForCurrentUser.find(p => p.id === selectedProjectId)) {
        setSelectedProjectId(projectsForCurrentUser[0].id);
    } else if (projectsForCurrentUser.length === 0) {
        setSelectedProjectId(null);
    }
  }, [projectsForCurrentUser, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (!currentUser) return;
    
    let availableTabs: Tab[] = ['משימות', 'זמנים'];
    if (currentUser.role === 'Super Admin') availableTabs = ['Portfolio', 'משימות', 'זמנים', 'כספים'];
    else if (currentUser.role === 'Team Leader') availableTabs = ['משימות', 'זמנים', 'כספים'];
    else if (currentUser.role === 'Guest') availableTabs = ['משימות', 'זמנים'];

    if (!availableTabs.includes(activeTab)) {
      if (currentUser.role === 'Super Admin') setActiveTab('Portfolio');
      else setActiveTab('משימות');
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    let title = 'מנהל פרויקטים חכם';
    if (view === 'settings') {
      title = 'הגדרות | ' + title;
    } else if (selectedProjectId && projects.length > 0) {
      const projectName = projects.find(p => p.id === selectedProjectId)?.name || '';
      if(projectName) {
        title = `${activeTab} - ${projectName} | ${title}`;
      } else {
        title = `${activeTab} | ${title}`;
      }
    } else {
      title = `${activeTab} | ${title}`;
    }
    document.title = title;
  }, [activeTab, view, selectedProjectId, projects]);

  const handleToggleSettings = () => {
    setView(prev => prev === 'dashboard' ? 'settings' : 'dashboard');
    setSettingsInitialSection(null);
  };
  
  const handleGoToCreateTeam = () => {
    setShowOnboardingModal(false);
    setView('settings');
    setSettingsInitialSection('team-management');
  };

  const handleBackToDashboard = () => {
      setView('dashboard');
      setSettingsInitialSection(null);
  };
  
  const handleSuccessfulRegistration = () => {
      setView('dashboard');
      setActiveTab('Portfolio');
      setShowOnboardingModal(true);
  };

  const handleShowLegalDocument = (title: string, content: string) => {
    setLegalViewContent({ title, content });
  };

  const handleHideLegalDocument = () => {
    setLegalViewContent(null);
  };
  
  if (isAppLoading) {
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
    return <LoginView onLogin={handleLogin} onRegister={handleRegistration} onShowLegalDocument={handleShowLegalDocument} onRegistrationSuccess={handleSuccessfulRegistration} />;
  }
  
  const tasksForView = useMemo(() => {
    if (!selectedProjectId) {
      if (currentUser.role === 'Employee') return tasks.filter(task => task.assigneeIds.includes(currentUser.id));
      return [];
    }
    const projectTasks = tasks.filter(task => task.projectId === selectedProjectId);
    if (currentUser.role === 'Guest' || currentUser.role === 'Super Admin' || currentUser.role === 'Team Leader') {
      return projectTasks;
    }
    return projectTasks.filter(task => task.assigneeIds.includes(currentUser.id));
  }, [currentUser, tasks, selectedProjectId]);


  const renderContent = () => {
    switch (activeTab) {
      case 'Portfolio':
        return currentUser.role === 'Super Admin' ? <div id="tabpanel-Portfolio" role="tabpanel" aria-labelledby="tab-Portfolio"><PortfolioView /></div> : null;
      case 'זמנים':
        return <div id="tabpanel-זמנים" role="tabpanel" aria-labelledby="tab-זמנים"><TimesView tasks={tasksForView} /></div>;
      case 'כספים':
        return (currentUser.role === 'Super Admin' || currentUser.role === 'Team Leader') ? <div id="tabpanel-כספים" role="tabpanel" aria-labelledby="tab-כספים"><FinancesView /></div> : null;
      case 'משימות':
        return <div id="tabpanel-משימות" role="tabpanel" aria-labelledby="tab-משימות"><KanbanBoard tasks={tasksForView} /></div>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-light font-sans flex flex-col">
       <a href="#main-content" className="absolute w-px h-px p-0 -m-px overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap border-0 focus:w-auto focus:h-auto focus:p-2 focus:m-0 focus:overflow-visible focus:[clip:auto] focus:z-[100] focus:top-2 focus:right-2 bg-accent text-light rounded-lg">דלג לתוכן המרכזי</a>
      <Toast message={globalError} onClose={() => setGlobalError(null)} />
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
      {showOnboardingModal && (
          <OnboardingModal
              user={currentUser}
              onClose={() => setShowOnboardingModal(false)}
              onGoToCreateTeam={handleGoToCreateTeam}
          />
      )}
      {view === 'dashboard' && <TabBar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />}
      <main id="main-content" className="p-4 sm:p-6 lg:p-8 flex-grow">
        {view === 'dashboard' ? (
            renderContent()
        ) : (
            <SettingsView 
                onBackToDashboard={handleBackToDashboard}
                initialSection={settingsInitialSection}
            />
        )}
      </main>
    </div>
  );
};

export default App;