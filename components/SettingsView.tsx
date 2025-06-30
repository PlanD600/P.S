import React, { useState, useMemo, useEffect } from 'react';
import { User, Team, NotificationPreferences, UserRole } from '../types';
import Icon from './Icon';

export type ActiveSection = 'my-profile' | 'user-management' | 'team-management' | 'general' | 'billing' | 'my-team';

interface SettingsViewProps {
    currentUser: User;
    allUsers: User[];
    teams: Team[];
    organizationSettings: { name: string; logoUrl: string };
    onUpdateUser: (user: User) => void;
    onCreateUser: (user: Omit<User, 'id' | 'avatarUrl'>) => void;
    onDeleteUser: (userId: string) => void;
    onUpdateTeam: (team: Team, leaderId: string | null, memberIds: string[]) => void;
    onCreateTeam: (team: Omit<Team, 'id'>, leaderId: string, memberIds: string[]) => void;
    onDeleteTeam: (teamId: string) => void;
    onUpdateOrganizationSettings: (settings: { name: string; logoUrl: string }) => void;
    onBackToDashboard: () => void;
    onAddUsersToTeam: (userIds: string[], teamId: string) => void;
    onRemoveUserFromTeam: (userId: string) => void;
    initialSection: ActiveSection | null;
}

const SettingsView: React.FC<SettingsViewProps> = (props) => {
    const { currentUser, onBackToDashboard, initialSection } = props;
    
    const getDefaultSection = (role: User['role']): ActiveSection => {
        if (role === 'Super Admin') return 'general';
        if (role === 'Team Leader') return 'my-team';
        return 'my-profile';
    };
    
    const [activeSection, setActiveSection] = useState<ActiveSection>(initialSection || getDefaultSection(currentUser.role));

    useEffect(() => {
        if (initialSection) {
            setActiveSection(initialSection);
        }
    }, [initialSection]);

    const menuItems = useMemo(() => {
        const items: { id: ActiveSection, label: string, icon: any }[] = [
            { id: 'my-profile', label: 'הפרופיל שלי', icon: 'user' },
        ];

        if (currentUser.role === 'Team Leader') {
            items.push({ id: 'my-team', label: 'הצוות שלי', icon: 'team' });
        }

        if (currentUser.role === 'Super Admin') {
            items.unshift(
                { id: 'general', label: 'כללי', icon: 'settings' },
                { id: 'user-management', label: 'ניהול משתמשים', icon: 'users' },
                { id: 'team-management', label: 'ניהול צוותים', icon: 'team' },
                { id: 'billing', label: 'חיובים', icon: 'billing' }
            );
        }
        return items;
    }, [currentUser.role]);
    
    return (
        <div className="bg-medium p-6 rounded-lg shadow-sm border border-dark">
            <button onClick={onBackToDashboard} className="flex items-center text-sm text-accent hover:underline mb-6">
                &rarr; חזרה ללוח המחוונים
            </button>
            <div className="flex flex-col md:flex-row-reverse gap-8">
                <aside className="md:w-1/4">
                    <h2 className="text-xl font-bold text-primary mb-4">הגדרות</h2>
                    <nav className="space-y-2">
                        {menuItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`w-full flex items-center space-x-3 space-x-reverse px-3 py-2 rounded-lg text-right transition-colors ${
                                    activeSection === item.id 
                                    ? 'bg-primary text-light font-semibold' 
                                    : 'text-dimmed hover:bg-dark/50 hover:text-primary'
                                }`}
                            >
                                <Icon name={item.icon} className="w-5 h-5" />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="flex-1 min-w-0">
                    {activeSection === 'my-profile' && <MyProfileSection {...props} />}
                    {currentUser.role === 'Super Admin' && activeSection === 'general' && <GeneralSettingsSection {...props} />}
                    {currentUser.role === 'Super Admin' && activeSection === 'user-management' && <UserManagementSection {...props} />}
                    {currentUser.role === 'Super Admin' && activeSection === 'team-management' && <SuperAdminTeamManagementSection {...props} />}
                    {currentUser.role === 'Super Admin' && activeSection === 'billing' && <BillingSection />}

                    {currentUser.role === 'Team Leader' && activeSection === 'my-team' && <TeamLeaderTeamSection {...props} />}
                </main>
            </div>
        </div>
    );
};

const SectionWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-2xl font-bold text-primary border-b border-dark pb-3 mb-6">{title}</h3>
        <div className="space-y-6">{children}</div>
    </div>
);

const MyProfileSection: React.FC<Omit<SettingsViewProps, 'initialSection'>> = ({ currentUser, onUpdateUser }) => {
    const [user, setUser] = useState(currentUser);
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });

    useEffect(() => {
        setUser(currentUser);
    }, [currentUser]);

    const handlePrefChange = (pref: keyof NotificationPreferences) => {
        const newPrefs = { ...user.notificationPreferences, [pref]: !user.notificationPreferences?.[pref] };
        setUser({ ...user, notificationPreferences: newPrefs as NotificationPreferences });
    };

    const handleSaveChanges = () => {
        onUpdateUser(user);
        alert("הפרופיל עודכן בהצלחה!");
    };
    
    const handleUpdatePassword = () => {
        if(passwordData.new !== passwordData.confirm) {
            alert("הסיסמאות החדשות אינן תואמות.");
            return;
        }
        if(!passwordData.new || !passwordData.current) {
            alert("אנא מלא את כל שדות הסיסמה.");
            return;
        }
        // In a real app, you'd validate the current password here.
        alert("הסיסמה עודכנה בהצלחה!");
        setPasswordData({ current: '', new: '', confirm: '' });
    };

    return (
        <SectionWrapper title="הפרופיל שלי">
            <div className="bg-light p-6 rounded-lg border border-dark">
                <h4 className="text-lg font-semibold text-primary mb-4">פרטים אישיים</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="text-sm font-medium text-dimmed block mb-1">שם מלא</label>
                        <input type="text" value={user.name} onChange={e => setUser({...user, name: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-dimmed block mb-1">אימייל</label>
                        <input type="email" value={user.email} onChange={e => setUser({...user, email: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                    </div>
                </div>
                 <button onClick={handleSaveChanges} className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm">שמור שינויים</button>
            </div>

            <div className="bg-light p-6 rounded-lg border border-dark">
                <h4 className="text-lg font-semibold text-primary mb-4">שינוי סיסמה</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label className="text-sm font-medium text-dimmed block mb-1">סיסמה נוכחית</label>
                        <input type="password" value={passwordData.current} onChange={e => setPasswordData(p => ({...p, current: e.target.value}))} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-dimmed block mb-1">סיסמה חדשה</label>
                        <input type="password" value={passwordData.new} onChange={e => setPasswordData(p => ({...p, new: e.target.value}))} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-dimmed block mb-1">אימות סיסמה חדשה</label>
                        <input type="password" value={passwordData.confirm} onChange={e => setPasswordData(p => ({...p, confirm: e.target.value}))} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                    </div>
                </div>
                 <button onClick={handleUpdatePassword} className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm">עדכן סיסמה</button>
            </div>
            {currentUser.role !== 'Guest' && (
             <div className="bg-light p-6 rounded-lg border border-dark">
                <h4 className="text-lg font-semibold text-primary mb-4">העדפות התראות</h4>
                <div className="space-y-2">
                    {user.notificationPreferences && Object.keys(user.notificationPreferences).map(key => (
                         <label key={key} className="flex items-center space-x-3 space-x-reverse cursor-pointer">
                            <input type="checkbox" checked={user.notificationPreferences?.[key as keyof NotificationPreferences]} onChange={() => handlePrefChange(key as keyof NotificationPreferences)} className="h-5 w-5 rounded bg-light border-dark text-accent focus:ring-accent"/>
                            <span className="text-primary">קבל התראה על: {key.replace('on', '').replace(/([A-Z])/g, ' $1')}</span>
                        </label>
                    ))}
                </div>
                 <button onClick={handleSaveChanges} className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm">שמור העדפות</button>
            </div>
            )}
        </SectionWrapper>
    );
};

const GeneralSettingsSection: React.FC<Omit<SettingsViewProps, 'initialSection'>> = ({ organizationSettings, onUpdateOrganizationSettings }) => (
    <SectionWrapper title="הגדרות ארגון כלליות">
         <div className="bg-light p-6 rounded-lg border border-dark">
            <h4 className="text-lg font-semibold text-primary mb-4">פרטי הארגון</h4>
            <div>
                <label className="text-sm font-medium text-dimmed block mb-1">שם הארגון</label>
                <input type="text" value={organizationSettings.name} onChange={e => onUpdateOrganizationSettings({...organizationSettings, name: e.target.value})} className="w-full md:w-1/2 bg-light p-2 rounded-md text-primary border border-dark"/>
            </div>
             <div className="mt-4">
                <label className="text-sm font-medium text-dimmed block mb-1">לוגו</label>
                <input type="file" className="text-sm text-primary file:ml-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-primary hover:file:bg-accent-hover"/>
            </div>
        </div>
    </SectionWrapper>
);

const UserManagementSection: React.FC<Omit<SettingsViewProps, 'initialSection'>> = (props) => {
    const { allUsers, teams, onDeleteUser } = props;
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [resettingUser, setResettingUser] = useState<User | null>(null);

    const handleOpenCreate = () => {
        setEditingUser(null);
        setUserModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setEditingUser(user);
        setUserModalOpen(true);
    };

    const handleResetPassword = (user: User) => {
        setResettingUser(user);
    };
    
    const confirmAndSendReset = () => {
        if (!resettingUser) return;
        alert(`קישור לאיפוס סיסמה נשלח אל ${resettingUser.email}.`);
        setResettingUser(null);
    };

    return(
        <SectionWrapper title="ניהול משתמשים">
             <div className="bg-light p-6 rounded-lg border border-dark">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={handleOpenCreate} className="flex items-center space-x-2 space-x-reverse px-3 py-1.5 bg-primary text-light rounded-md text-sm"><Icon name="plus" className="w-4 h-4" /> <span>הוסף משתמש</span></button>
                    <h4 className="text-lg font-semibold text-primary">כל המשתמשים</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-primary">
                        <thead className="text-xs uppercase bg-medium text-dimmed">
                            <tr>
                                <th className="px-4 py-3">שם</th>
                                <th className="px-4 py-3">תפקיד</th>
                                <th className="px-4 py-3">צוות</th>
                                <th className="px-4 py-3">סטטוס</th>
                                <th className="px-4 py-3">פעולות</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allUsers.filter(u => u.role !== 'Guest').map(user => (
                                <tr key={user.id} className="border-b border-dark hover:bg-medium">
                                    <td className="px-4 py-3 font-semibold text-primary flex items-center gap-3">
                                        <img src={user.avatarUrl} className="w-8 h-8 rounded-full" />
                                        <div>
                                            {user.name}
                                            <div className="text-xs text-dimmed">{user.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{user.role}</td>
                                    <td className="px-4 py-3 text-dimmed">{teams.find(t => t.id === user.teamId)?.name || 'ללא שיוך'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 text-xs rounded-full ${user.disabled ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'}`}>
                                            {user.disabled ? 'מושבת' : 'פעיל'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3 text-dimmed">
                                            <button onClick={() => handleOpenEdit(user)} title="ערוך משתמש" className="hover:text-accent"><Icon name="edit" className="w-4 h-4"/></button>
                                            <button onClick={() => handleResetPassword(user)} title="אפס סיסמה" className="hover:text-accent"><Icon name="key" className="w-4 h-4"/></button>
                                            <button onClick={() => onDeleteUser(user.id)} title="השבת משתמש" className="hover:text-danger"><Icon name="trash" className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {isUserModalOpen && (
                <UserModal
                    isOpen={isUserModalOpen}
                    onClose={() => setUserModalOpen(false)}
                    userToEdit={editingUser}
                    {...props}
                />
            )}
            {resettingUser && (
                <ResetPasswordModal
                    isOpen={!!resettingUser}
                    onClose={() => setResettingUser(null)}
                    onConfirm={confirmAndSendReset}
                    userEmail={resettingUser.email}
                />
            )}
        </SectionWrapper>
    );
};

const SuperAdminTeamManagementSection: React.FC<Omit<SettingsViewProps, 'initialSection'>> = (props) => {
    const { teams, allUsers, onDeleteTeam } = props;
    const [isTeamModalOpen, setTeamModalOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);

    const handleOpenCreate = () => {
        setEditingTeam(null);
        setTeamModalOpen(true);
    };

    const handleOpenEdit = (team: Team) => {
        setEditingTeam(team);
        setTeamModalOpen(true);
    };

    return(
        <SectionWrapper title="ניהול צוותים">
             <div className="bg-light p-6 rounded-lg border border-dark">
                 <div className="flex justify-between items-center mb-4">
                    <button onClick={handleOpenCreate} className="flex items-center space-x-2 space-x-reverse px-3 py-1.5 bg-primary text-light rounded-md text-sm"><Icon name="plus" className="w-4 h-4" /> <span>צור צוות</span></button>
                    <h4 className="text-lg font-semibold text-primary">כל הצוותים</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-primary">
                         <thead className="text-xs uppercase bg-medium text-dimmed">
                            <tr>
                                <th className="px-4 py-3">שם הצוות</th>
                                <th className="px-4 py-3">ראש צוות</th>
                                <th className="px-4 py-3">חברים</th>
                                <th className="px-4 py-3">פעולות</th>
                            </tr>
                        </thead>
                         <tbody>
                            {teams.map(team => {
                                const leader = allUsers.find(l => l.teamId === team.id && l.role === 'Team Leader');
                                const members = allUsers.filter(u => u.teamId === team.id);
                                return (
                                    <tr key={team.id} className="border-b border-dark hover:bg-medium">
                                        <td className="px-4 py-3 font-semibold text-primary">{team.name}</td>
                                        <td className="px-4 py-3 text-dimmed">{leader?.name || 'לא שויך'}</td>
                                        <td className="px-4 py-3 text-dimmed">{members.length}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3 text-dimmed">
                                                <button onClick={() => handleOpenEdit(team)} title="ערוך צוות" className="hover:text-accent"><Icon name="edit" className="w-4 h-4"/></button>
                                                <button onClick={() => onDeleteTeam(team.id)} title="מחק צוות" className="hover:text-danger"><Icon name="trash" className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                         </tbody>
                    </table>
                </div>
            </div>
             {isTeamModalOpen && (
                <TeamModal
                    isOpen={isTeamModalOpen}
                    onClose={() => setTeamModalOpen(false)}
                    teamToEdit={editingTeam}
                    {...props}
                />
            )}
        </SectionWrapper>
    );
};

const TeamLeaderTeamSection: React.FC<Omit<SettingsViewProps, 'initialSection'>> = ({ currentUser, teams, allUsers, onUpdateTeam, onAddUsersToTeam, onRemoveUserFromTeam }) => {
    const [teamName, setTeamName] = useState('');
    const [isAddMemberOpen, setAddMemberOpen] = useState(false);
    
    const myTeam = useMemo(() => teams.find(t => t.id === currentUser.teamId), [teams, currentUser]);
    const myTeamMembers = useMemo(() => allUsers.filter(u => u.teamId === currentUser.teamId && u.id !== currentUser.id), [allUsers, currentUser]);

    useEffect(() => {
        if (myTeam) setTeamName(myTeam.name);
    }, [myTeam]);

    if (!myTeam) return <SectionWrapper title="הצוות שלי">אינך משויך לצוות.</SectionWrapper>;
    
    const unassignedUsers = allUsers.filter(u => !u.teamId && u.role === 'Employee');

    const handleUpdateTeamName = () => {
        onUpdateTeam({ ...myTeam, name: teamName }, currentUser.id, myTeamMembers.map(m => m.id));
        alert("שם הצוות עודכן!");
    };
    
    const handleAddSelectedUsers = (selectedUserIds: string[]) => {
        onAddUsersToTeam(selectedUserIds, myTeam.id);
        setAddMemberOpen(false);
    }

    return (
         <SectionWrapper title="הצוות שלי">
             <div className="bg-light p-6 rounded-lg border border-dark">
                 <h4 className="text-lg font-semibold text-primary mb-4">הגדרות צוות</h4>
                 <div>
                    <label className="text-sm font-medium text-dimmed block mb-1">שם הצוות</label>
                    <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full md:w-1/2 bg-light p-2 rounded-md text-primary border border-dark"/>
                 </div>
                 <button onClick={handleUpdateTeamName} className="mt-4 px-4 py-2 bg-primary text-light rounded-md text-sm">שמור שינויים</button>
            </div>
            <div className="bg-light p-6 rounded-lg border border-dark">
                 <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setAddMemberOpen(true)} className="flex items-center space-x-2 space-x-reverse px-3 py-1.5 bg-primary text-light rounded-md text-sm"><Icon name="plus" className="w-4 h-4" /> <span>הוסף חבר צוות</span></button>
                    <h4 className="text-lg font-semibold text-primary">חברי הצוות ({myTeamMembers.length + 1})</h4>
                </div>
                 <div className="space-y-3">
                     {/* Team Leader */}
                     <div className="flex items-center space-x-3 space-x-reverse bg-medium p-3 rounded-md">
                         <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full" />
                         <div>
                             <div className="text-primary font-bold">{currentUser.name} <span className="text-xs font-normal px-2 py-0.5 bg-accent/50 text-primary rounded-full">ראש צוות</span></div>
                             <div className="text-sm text-dimmed">{currentUser.email}</div>
                         </div>
                     </div>
                     {/* Team Members */}
                     {myTeamMembers.map(user => (
                         <div key={user.id} className="flex items-center justify-between space-x-3 space-x-reverse bg-medium p-3 rounded-md">
                             <button onClick={() => onRemoveUserFromTeam(user.id)} title="הסר מהצוות" className="text-dimmed hover:text-danger p-1 rounded-full"><Icon name="close" className="w-5 h-5"/></button>
                             <div className="flex items-center space-x-3 space-x-reverse">
                                <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full" />
                                <div>
                                    <div className="text-primary font-medium">{user.name}</div>
                                    <div className="text-sm text-dimmed">{user.email}</div>
                                </div>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
             {isAddMemberOpen && (
                 <AddTeamMemberModal 
                    isOpen={isAddMemberOpen}
                    onClose={() => setAddMemberOpen(false)}
                    unassignedUsers={unassignedUsers}
                    onAddMembers={handleAddSelectedUsers}
                 />
             )}
         </SectionWrapper>
    )
};

const BillingSection: React.FC = () => (
    <SectionWrapper title="חיובים ומנוי">
        <div className="bg-light p-6 rounded-lg text-center text-dimmed border border-dark">
            <p>ניהול החיובים מתבצע דרך לוח הבקרה של חשבונך.</p>
            <p>זהו תוכן זמני עבור ממשק ניהול החיובים.</p>
        </div>
    </SectionWrapper>
);

// Modals defined as components within the same file to keep changes minimal
const UserModal: React.FC<Omit<SettingsViewProps, 'initialSection'> & { isOpen: boolean; onClose: () => void; userToEdit: User | null }> = ({ isOpen, onClose, userToEdit, teams, onCreateUser, onUpdateUser }) => {
    const [formData, setFormData] = useState({
        name: userToEdit?.name || '',
        email: userToEdit?.email || '',
        role: userToEdit?.role || 'Employee',
        teamId: userToEdit?.teamId || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userToEdit) {
            onUpdateUser({ ...userToEdit, ...formData, teamId: formData.teamId || undefined });
        } else {
            onCreateUser(formData);
        }
        onClose();
    };
    
    if (!isOpen) return null;

    return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <form className="bg-medium rounded-lg shadow-2xl w-full max-w-lg border border-dark" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <header className="p-4 border-b border-dark flex justify-between items-center">
            <button type="button" onClick={onClose}><Icon name="close" /></button>
            <h2 className="text-xl font-bold text-primary">{userToEdit ? 'ערוך משתמש' : 'הוסף משתמש חדש'}</h2>
        </header>
        <main className="p-6 space-y-4">
            <div>
                <label className="text-sm text-dimmed block mb-1">שם מלא</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark" required />
            </div>
             <div>
                <label className="text-sm text-dimmed block mb-1">כתובת אימייל</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark" disabled={!!userToEdit} required />
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm text-dimmed block mb-1">תפקיד</label>
                    <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full bg-light p-2 rounded-md text-primary border border-dark">
                        <option value="Employee">עובד</option>
                        <option value="Team Leader">ראש צוות</option>
                        <option value="Super Admin">מנהל מערכת</option>
                    </select>
                </div>
                 <div>
                    <label className="text-sm text-dimmed block mb-1">צוות</label>
                     <select value={formData.teamId} onChange={e => setFormData({...formData, teamId: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark">
                        <option value="">ללא שיוך</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
             </div>
             <div>
                <label className="text-sm text-dimmed block mb-1">תמונת פרופיל</label>
                <input type="file" className="text-sm text-primary file:ml-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent/80 file:text-primary hover:file:bg-accent"/>
             </div>
        </main>
        <footer className="p-4 bg-medium/50 border-t border-dark flex justify-end gap-3">
            <button type="submit" className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light">{userToEdit ? 'שמור שינויים' : 'צור משתמש'}</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
        </footer>
      </form>
    </div>
    )
};


const TeamModal: React.FC<Omit<SettingsViewProps, 'initialSection'> & { isOpen: boolean; onClose: () => void; teamToEdit: Team | null }> = ({ isOpen, onClose, teamToEdit, allUsers, onCreateTeam, onUpdateTeam }) => {
    const leaderAndAdmins = useMemo(() => allUsers.filter(u => u.role === 'Team Leader' || u.role === 'Super Admin'), [allUsers]);
    const employees = useMemo(() => allUsers.filter(u => u.role === 'Employee'), [allUsers]);

    const getInitialMembers = () => teamToEdit ? allUsers.filter(u => u.teamId === teamToEdit.id && u.role === 'Employee').map(u => u.id) : [];
    const getInitialLeader = () => teamToEdit ? allUsers.find(u => u.teamId === teamToEdit.id && (u.role === 'Team Leader' || u.role === 'Super Admin'))?.id || null : null;

    const [name, setName] = useState(teamToEdit?.name || '');
    const [leaderId, setLeaderId] = useState<string | null>(getInitialLeader());
    const [memberIds, setMemberIds] = useState<string[]>(getInitialMembers());

    const availableMembers = employees.filter(e => !e.teamId || memberIds.includes(e.id));
    
    const handleMemberToggle = (id: string) => {
        setMemberIds(prev => prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!leaderId) {
            alert("אנא בחר ראש צוות.");
            return;
        }
        if (teamToEdit) {
            onUpdateTeam({ ...teamToEdit, name }, leaderId, memberIds);
        } else {
            onCreateTeam({ name }, leaderId, memberIds);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
     <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <form className="bg-medium rounded-lg shadow-2xl w-full max-w-lg border border-dark" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <header className="p-4 border-b border-dark flex justify-between items-center">
            <button type="button" onClick={onClose}><Icon name="close" /></button>
            <h2 className="text-xl font-bold text-primary">{teamToEdit ? 'ערוך צוות' : 'צור צוות חדש'}</h2>
        </header>
        <main className="p-6 space-y-4">
             <div>
                <label className="text-sm text-dimmed block mb-1">שם הצוות</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-light p-2 rounded-md text-primary border border-dark" required />
            </div>
             <div>
                <label className="text-sm text-dimmed block mb-1">בחר ראש צוות</label>
                <select value={leaderId || ''} onChange={e => setLeaderId(e.target.value)} className="w-full bg-light p-2 rounded-md text-primary border border-dark" required>
                    <option value="" disabled>בחר ראש צוות</option>
                    {leaderAndAdmins.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
            </div>
            <div>
                <label className="text-sm text-dimmed block mb-1">הוסף חברי צוות</label>
                <div className="bg-light p-2 rounded-md border border-dark max-h-48 overflow-y-auto">
                    {availableMembers.map(user => (
                         <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-dark/50 rounded-md cursor-pointer">
                            <input type="checkbox" checked={memberIds.includes(user.id)} onChange={() => handleMemberToggle(user.id)} className="h-4 w-4 rounded bg-light border-dark text-accent focus:ring-accent"/>
                            <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full"/>
                            <span className="text-primary">{user.name}</span>
                        </label>
                    ))}
                </div>
            </div>
        </main>
        <footer className="p-4 bg-medium/50 border-t border-dark flex justify-end gap-3">
            <button type="submit" className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light">{teamToEdit ? 'שמור שינויים' : 'צור צוות'}</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
        </footer>
      </form>
    </div>
    )
};

const AddTeamMemberModal: React.FC<{ isOpen: boolean; onClose: () => void; unassignedUsers: User[]; onAddMembers: (selectedIds: string[]) => void; }> = ({ isOpen, onClose, unassignedUsers, onAddMembers }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(uId => uId !== id) : [...prev, id]);
    };

    const handleSubmit = () => {
        onAddMembers(selectedIds);
        onClose();
    };

    if (!isOpen) return null;

     return (
     <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-medium rounded-lg shadow-2xl w-full max-w-md border border-dark" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-dark flex justify-between items-center">
            <button type="button" onClick={onClose}><Icon name="close" /></button>
            <h2 className="text-xl font-bold text-primary">הוסף חברי צוות</h2>
        </header>
        <main className="p-6">
            <p className="text-sm text-dimmed mb-4">בחר מבין העובדים הלא משויכים כדי להוסיף לצוות שלך.</p>
            <div className="bg-light p-2 rounded-md border border-dark max-h-64 overflow-y-auto space-y-1">
                {unassignedUsers.length > 0 ? unassignedUsers.map(user => (
                    <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-dark/50 rounded-md cursor-pointer">
                        <input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => handleToggle(user.id)} className="h-4 w-4 rounded bg-light border-dark text-accent focus:ring-accent"/>
                        <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full"/>
                        <span className="text-primary">{user.name}</span>
                    </label>
                )) : (
                    <div className="text-center text-dimmed p-4">אין עובדים לא משויכים זמינים.</div>
                )}
            </div>
        </main>
        <footer className="p-4 bg-medium/50 border-t border-dark flex justify-end gap-3">
            <button onClick={handleSubmit} disabled={selectedIds.length === 0} className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light disabled:opacity-50">הוסף נבחרים</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
        </footer>
      </div>
    </div>
    )
};

const ResetPasswordModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; userEmail: string; }> = ({ isOpen, onClose, onConfirm, userEmail }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[70] p-4" onClick={onClose}>
            <div className="bg-medium rounded-lg shadow-2xl w-full max-w-md border border-dark" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-dark flex justify-between items-center">
                    <button type="button" onClick={onClose} className="text-dimmed hover:text-primary">
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                    <h2 className="text-xl font-bold text-primary">אישור איפוס סיסמה</h2>
                </header>
                <div className="p-6">
                    <p className="text-primary">
                        האם אתה בטוח שברצונך לשלוח קישור לאיפוס סיסמה אל <strong className="text-primary">{userEmail}</strong>?
                    </p>
                    <p className="text-sm text-dimmed mt-2">
                        המשתמש יקבל אימייל עם הוראות לקביעת סיסמה חדשה. לא תוכל לראות או להגדיר את הסיסמה בעצמך.
                    </p>
                </div>
                <footer className="p-4 bg-medium/50 border-t border-dark flex justify-end gap-3">
                    <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light">אשר ושלח</button>
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
                </footer>
            </div>
        </div>
    );
};

export default SettingsView;