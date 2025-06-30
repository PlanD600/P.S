import React from 'react';
import { User } from '../types';
import Icon from './Icon';

export type Tab = 'Portfolio' | 'זמנים' | 'כספים' | 'משימות';

interface TabBarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  currentUser: User;
}

interface TabItem {
    name: Tab;
    label: string;
    icon: 'briefcase' | 'gantt-chart' | 'banknotes' | 'users';
}

const TABS: TabItem[] = [
    { name: 'Portfolio', label: 'פורטפוליו', icon: 'briefcase' },
    { name: 'משימות', label: 'משימות', icon: 'users' },
    { name: 'זמנים', label: 'זמנים', icon: 'gantt-chart' },
    { name: 'כספים', label: 'כספים', icon: 'banknotes' },
];

const TabBar: React.FC<TabBarProps> = ({ activeTab, setActiveTab, currentUser }) => {
    let availableTabs: TabItem[];

    switch (currentUser.role) {
        case 'Super Admin':
            availableTabs = TABS;
            break;
        case 'Team Leader':
            availableTabs = TABS.filter(tab => tab.name !== 'Portfolio');
            break;
        case 'Employee':
            availableTabs = TABS.filter(tab => tab.name !== 'Portfolio' && tab.name !== 'כספים');
            break;
        case 'Guest':
            availableTabs = TABS.filter(tab => tab.name === 'משימות' || tab.name === 'זמנים');
            break;
        default:
            availableTabs = [];
    }

  return (
    <nav className="bg-light px-4 sm:px-6 lg:px-8 border-b border-dark">
      <div className="flex space-x-4 space-x-reverse">
        {availableTabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`flex items-center space-x-2 space-x-reverse px-3 py-3 text-sm font-medium transition-colors border-b-2
              ${
                activeTab === tab.name
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-dimmed hover:text-primary'
              }`}
          >
            <Icon name={tab.icon} className="w-5 h-5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default TabBar;