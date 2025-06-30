import React from 'react';
import { Project, User } from '../types';

interface ProjectSelectorProps {
    projects: Project[];
    selectedProjectId: string | null;
    onSelectProject: (projectId: string) => void;
    currentUser: User;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, selectedProjectId, onSelectProject, currentUser }) => {
    
    if (currentUser.role === 'Employee') {
        return null; // Employees do not get a project selector
    }

    const canSelect = projects.length > 0;

    return (
        <select
            value={selectedProjectId || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            disabled={!canSelect}
            className="w-full bg-medium text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent text-sm disabled:cursor-not-allowed disabled:bg-dark/50"
        >
            {canSelect ? (
                <>
                    <option value="" disabled>בחר פרויקט...</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </>
            ) : (
                <option value="">אין פרויקטים זמינים</option>
            )}
        </select>
    );
};

export default ProjectSelector;