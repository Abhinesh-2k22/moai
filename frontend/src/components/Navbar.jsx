import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { LogOut, PieChart, Users, Home, Scale, StickyNote, Wallet, UserCircle, CreditCard, Sun, Moon, Landmark } from 'lucide-react';
import Avatar from './Avatar';
import ProfileModal from './ProfileModal';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <>
            <nav className="glass sticky top-0 z-40 border-b border-gray-200/50 dark:border-slate-800/80">
            <div className="container mx-auto px-2 md:px-4">
                <div className="flex justify-between items-center py-2 md:py-2.5">
                    <Link to="/" className="flex items-center gap-1 md:gap-1.5 group">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1 md:p-1.5 rounded-lg text-white shadow-lg group-hover:shadow-indigo-500/30 transition-all duration-300 flex items-center justify-center">
                            <Landmark className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <span className="text-base md:text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tight">
                            Moai<span className="hidden sm:inline"> Finance</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-0.5 md:gap-1.5 bg-white/50 dark:bg-slate-900/50 px-1 md:px-3 py-1 md:py-1.5 rounded-full border border-white/50 dark:border-slate-800/80 shadow-sm backdrop-blur-md overflow-x-auto hide-scrollbar">
                        <Link
                            to="/"
                            className={`flex items-center gap-1 px-1.5 md:px-2.5 py-1 text-xs md:text-sm rounded-lg transition-all duration-300 ${isActive('/') ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                        >
                            <Home size={16} />
                            <span className="hidden md:inline">Dashboard</span>
                        </Link>
                        <Link
                            to="/analysis"
                            className={`flex items-center gap-1 px-1.5 md:px-2.5 py-1 text-xs md:text-sm rounded-lg transition-all duration-300 ${isActive('/analysis') ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                        >
                            <PieChart size={16} />
                            <span className="hidden md:inline">Analysis</span>
                        </Link>
                        <Link
                            to="/groups"
                            className={`flex items-center gap-1 px-1.5 md:px-2.5 py-1 text-xs md:text-sm rounded-lg transition-all duration-300 ${isActive('/groups') ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                        >
                            <Users size={16} />
                            <span className="hidden md:inline">Groups</span>
                        </Link>
                        <Link
                            to="/settlements"
                            className={`flex items-center gap-1 px-1.5 md:px-2.5 py-1 text-xs md:text-sm rounded-lg transition-all duration-300 ${isActive('/settlements') ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                        >
                            <Scale size={16} />
                            <span className="hidden md:inline">Settlements</span>
                        </Link>
                        <Link
                            to="/contacts"
                            className={`flex items-center gap-1 px-1.5 md:px-2.5 py-1 text-xs md:text-sm rounded-lg transition-all duration-300 ${isActive('/contacts') ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                        >
                            <UserCircle size={16} />
                            <span className="hidden md:inline">Contacts</span>
                        </Link>
                        <Link
                            to="/payment-methods"
                            className={`flex items-center gap-1 px-1.5 md:px-2.5 py-1 text-xs md:text-sm rounded-lg transition-all duration-300 ${isActive('/payment-methods') ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                        >
                            <CreditCard size={16} />
                            <span className="hidden md:inline">Payments</span>
                        </Link>
                        <Link
                            to="/notes"
                            className={`flex items-center gap-1 px-1.5 md:px-2.5 py-1 text-xs md:text-sm rounded-lg transition-all duration-300 ${isActive('/notes') ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                        >
                            <StickyNote size={16} />
                            <span className="hidden md:inline">Notes</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2.5">
                        <button
                            onClick={toggleTheme}
                            className="p-1 md:p-1.5 text-gray-400 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800/50 rounded-lg transition-all duration-300"
                            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        {user && (
                            <Avatar
                                user={user}
                                size="w-8 h-8"
                                className="cursor-pointer border border-gray-200/80 dark:border-slate-800 shadow-sm hover:scale-105 active:scale-95 transition-all"
                                onClick={() => setIsProfileModalOpen(true)}
                                title="Edit Profile Settings"
                            />
                        )}
                        <button
                            onClick={handleLogout}
                            className="p-1 md:p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all duration-300"
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>
            </nav>
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        </>
    );
};

export default Navbar;

