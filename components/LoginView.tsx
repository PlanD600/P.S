import React, { useState } from 'react';
import Icon from './Icon';
import Spinner from './Spinner';
import RegistrationModal from './RegistrationModal';

interface LoginViewProps {
    onLogin: (email: string, password: string) => Promise<string | null>;
    onRegister: (data: { fullName: string; email: string; password: string; companyName: string; }) => Promise<string | null>;
    onShowLegalDocument: (title: string, content: string) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, onShowLegalDocument }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError("אנא הזן אימייל וסיסמה.");
            return;
        }
        setError(null);
        setIsLoading(true);
        const loginError = await onLogin(email, password);
        if (loginError) {
            setError(loginError);
        }
        setIsLoading(false);
    };
    
    const handleRegister = async (data: { fullName: string; email: string; password: string; companyName: string; }) => {
        setIsLoading(true);
        const registrationError = await onRegister(data);
        if (registrationError) {
            // This error will be displayed inside the modal
            setIsLoading(false);
            return registrationError;
        }
        // On success, the modal will close and App will transition.
        setRegisterModalOpen(false);
        setIsLoading(false);
        return null;
    };

    return (
        <>
            <div className="min-h-screen bg-light flex flex-col justify-center items-center p-4 font-sans">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="inline-block bg-primary rounded-lg p-3 mb-4">
                            <svg className="w-8 h-8 text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z"></path>
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-primary">מנהל פרויקטים </h1>
                        <p className="text-dimmed mt-2">התחבר כדי להמשיך ללוח המחוונים שלך</p>
                    </div>

                    <form onSubmit={handleSubmit} className="bg-medium shadow-lg rounded-lg p-8 space-y-6 border border-dark">
                        {error && (
                            <div className="bg-danger/20 text-danger text-sm p-3 rounded-md text-center">
                                {error}
                            </div>
                        )}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-dimmed mb-1">כתובת אימייל</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                             <label htmlFor="password" className="block text-sm font-medium text-dimmed mb-1">סיסמה</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                             <a href="#" onClick={(e) => { e.preventDefault(); alert('הוראות לאיפוס סיסמה נשלחו לכתובת האימייל שלך.'); }} className="text-sm text-accent hover:underline">שכחת סיסמה?</a>
                            <div className="flex items-center">
                                <label htmlFor="remember-me" className="mr-2 block text-sm text-dimmed">זכור אותי</label>
                                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-accent bg-light border-dark rounded focus:ring-accent" />
                            </div>
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-light bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isLoading ? <Spinner /> : 'התחבר'}
                            </button>
                        </div>
                    </form>
                    <div className="text-center mt-6">
                        <p className="text-sm text-dimmed">
                            אין לך חשבון?{' '}
                            <a href="#" onClick={(e) => {e.preventDefault(); setRegisterModalOpen(true)}} className="font-medium text-accent hover:underline">
                                צור סביבת עבודה חדשה
                            </a>
                        </p>
                    </div>
                </div>
            </div>
             {isRegisterModalOpen && (
                <RegistrationModal
                    isOpen={isRegisterModalOpen}
                    onClose={() => setRegisterModalOpen(false)}
                    onRegister={handleRegister}
                    onShowLegalDocument={onShowLegalDocument}
                />
            )}
        </>
    );
};

export default LoginView;