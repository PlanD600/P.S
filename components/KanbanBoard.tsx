import React, { useState, useCallback } from 'react';
import { COLUMNS } from '../constants';
import { Task, User, Comment, Project } from '../types';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import AddTaskModal from './AddTaskModal';
import Icon from './Icon';
import InviteGuestModal from './InviteGuestModal';

interface KanbanBoardProps {
  tasks: Task[];
  onUpdateTask: (updatedTask: Task) => void;
  onAddTask: (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies'>) => void;
  onAddComment: (taskId: string, comment: Comment) => void;
  currentUser: User;
  users: User[];
  selectedProjectId: string | null;
  allProjects: Project[];
  onInviteGuest: (email: string, projectId: string) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onUpdateTask, onAddTask, onAddComment, currentUser, users, selectedProjectId, allProjects, onInviteGuest }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleOpenAddTaskModal = useCallback(() => {
    setAddTaskModalOpen(true);
  }, []);

  const handleCloseAddTaskModal = useCallback(() => {
    setAddTaskModalOpen(false);
  }, []);

  const handleCreateTask = useCallback((taskData: Pick<Task, 'title' | 'description' | 'assigneeIds' | 'startDate' | 'endDate' | 'projectId'>) => {
    onAddTask(taskData);
    setAddTaskModalOpen(false);
  }, [onAddTask]);

  const handleUpdateAndCloseModal = useCallback((updatedTask: Task) => {
    onUpdateTask(updatedTask);
    if (selectedTask && selectedTask.id === updatedTask.id) {
        setSelectedTask(updatedTask);
    }
  }, [selectedTask, onUpdateTask]);
  
  const handleCommentAndCloseModal = useCallback((taskId: string, comment: Comment) => {
      onAddComment(taskId, comment);
       const updatedTask = tasks.find(t => t.id === taskId);
       if (updatedTask && selectedTask && selectedTask.id === updatedTask.id) {
           setSelectedTask({...updatedTask, comments: [...updatedTask.comments, comment]});
       }
  }, [tasks, selectedTask, onAddComment]);

  const project = allProjects.find(p => p.id === selectedProjectId);
  const canInvite = selectedProjectId && (currentUser.role === 'Super Admin' || currentUser.role === 'Team Leader');

  return (
    <>
      <div className="flex justify-between items-center mb-6">
          {canInvite && (
               <button onClick={() => setInviteModalOpen(true)} title="הזמן אורח לפרויקט" className="flex items-center space-x-2 space-x-reverse bg-dark/10 hover:bg-dark/20 text-dark hover:text-accent p-2 rounded-lg transition-colors">
                  <Icon name="share-alt" className="w-5 h-5" />
                  <span className="text-sm font-semibold">שתף</span>
              </button>
          )}
          <h2 className="text-2xl font-bold text-secondary">{project?.name || "משימות"}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasks.filter(task => task.columnId === column.id)}
            onTaskClick={handleTaskClick}
            onOpenAddTaskModal={handleOpenAddTaskModal}
            canAddTask={currentUser.role === 'Super Admin' || currentUser.role === 'Team Leader'}
            canAddProject={!!selectedProjectId}
            users={users}
          />
        ))}
      </div>
      {selectedTask && (
        <TaskModal
          key={selectedTask.id}
          task={selectedTask}
          onClose={handleCloseModal}
          onUpdateTask={handleUpdateAndCloseModal}
          onAddComment={onAddComment}
          currentUser={currentUser}
          users={users}
          allProjects={allProjects}
        />
      )}
      {isAddTaskModalOpen && (
          <AddTaskModal
            isOpen={isAddTaskModalOpen}
            onClose={handleCloseAddTaskModal}
            onSubmit={handleCreateTask}
            users={users}
            currentUser={currentUser}
            projectId={selectedProjectId!}
          />
      )}
       {isInviteModalOpen && selectedProjectId && (
            <InviteGuestModal
                isOpen={isInviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                onInvite={(email) => onInviteGuest(email, selectedProjectId)}
            />
        )}
    </>
  );
};

export default KanbanBoard;