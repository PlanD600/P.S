import React, { useState, useRef, useEffect } from 'react';
import { User, Notification, Project, Comment, Task } from '../types';
import Notifications from './Notifications';
import ProjectSelector from './ProjectSelector';
import GlobalSearch from './GlobalSearch';
import Icon from './Icon';

type SearchResults = {
    projects: Project[];
    tasks: Task[];
    comments: (Comment & {task: Task})[];
}

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  notifications: Notification[];
  onSetNotificationsRead: (ids: string[]) => void;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onSearch: (query: string) => SearchResults;
  onGoToSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, notifications, onSetNotificationsRead, projects, selectedProjectId, onSelectProject, onSearch, onGoToSettings }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-medium shadow-md p-4 flex flex-wrap items-center justify-between gap-4 relative z-20 border-b border-dark">
      <div className="flex items-center space-x-4">
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2 cursor-pointer p-1 rounded-lg hover:bg-dark/50">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full border-2 border-accent"
            />
            <span className="hidden sm:block text-primary font-medium">{currentUser.name}</span>
          </button>
          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-56 bg-medium rounded-lg shadow-xl py-1 text-right border border-dark">
              <div className="px-4 py-3 border-b border-dark">
                  <p className="font-semibold text-primary truncate">{currentUser.name}</p>
                  <p className="text-sm text-dimmed truncate">{currentUser.email}</p>
              </div>
               <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); onGoToSettings(); setIsDropdownOpen(false); }}
                  className="w-full flex items-center justify-end gap-3 text-right px-4 py-2 text-sm text-primary hover:bg-dark/50"
                >
                  הפרופיל שלי
                  <Icon name="user" className="w-4 h-4 text-dimmed" />
                </a>
               <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); onLogout(); }}
                  className="w-full flex items-center justify-end gap-3 text-right px-4 py-2 text-sm text-primary hover:bg-dark/50"
                >
                  התנתקות
                  <Icon name="close" className="w-4 h-4 text-dimmed" />
                </a>
            </div>
          )}
        </div>
        <button onClick={onGoToSettings} aria-label="הגדרות" title="הגדרות" className="p-2 rounded-full text-dimmed hover:bg-dark/50 hover:text-accent transition-colors">
            <Icon name="settings" className="w-6 h-6" />
        </button>
         <Notifications 
          notifications={notifications} 
          currentUser={currentUser}
          onSetRead={onSetNotificationsRead}
        />
      </div>

       <div className="flex items-center space-x-3 order-first md:order-none">
        <h1 className="text-xl sm:text-2xl font-bold text-primary">מנהל פרויקטים חכם</h1>
         <div className="bg-primary rounded-lg p-2">
          <svg className="w-6 h-6 text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z"></path></svg>
        </div>
      </div>

      <div className="w-full flex flex-col md:flex-row md:flex-1 items-center gap-4 order-last">
        <div className="w-full md:w-auto md:max-w-sm">
           <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={onSelectProject}
            currentUser={currentUser}
          />
        </div>
         <div className="w-full md:flex-1 md:max-w-lg">
          <GlobalSearch onSearch={onSearch} onSelectProject={onSelectProject} />
        </div>
      </div>
    </header>
  );
};

export default Header;