import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, PieChart, Users, Home, Wallet, Scale, Bell } from 'lucide-react';
import NotificationInbox from './NotificationInbox';
import api from '../api/axios';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [isInboxOpen, setIsInboxOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        fetchNotificationCount();
        // Poll every 30 seconds
        const interval = setInterval(fetchNotificationCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchNotificationCount = async () => {
        try {
            const res = await api.get('/notifications');
            setNotificationCount(res.data.length);
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="glass sticky top-0 z-40 border-b border-gray-200/50">
            <div className="container mx-auto px-4">
                <div className="flex justify-between items-center py-4">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg text-white shadow-lg group-hover:shadow-indigo-500/30 transition-all duration-300">
                            <Wallet size={24} />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                            MOAI
                        </span>
                    </Link>

                    <div className="flex items-center gap-2 md:gap-6 bg-white/50 px-6 py-2 rounded-full border border-white/50 shadow-sm backdrop-blur-md">
                        <Link
                            to="/"
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${isActive('/') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <Home size={18} />
                            <span className="hidden md:inline">Dashboard</span>
                        </Link>
                        <Link
                            to="/analysis"
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${isActive('/analysis') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <PieChart size={18} />
                            <span className="hidden md:inline">Analysis</span>
                        </Link>
                        <Link
                            to="/groups"
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${isActive('/groups') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <Users size={18} />
                            <span className="hidden md:inline">Groups</span>
                        </Link>
                        <Link
                            to="/settlements"
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${isActive('/settlements') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <Scale size={18} />
                            <span className="hidden md:inline">Settlements</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setIsInboxOpen(!isInboxOpen)}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-300 relative"
                                title="Notifications"
                            >
                                <Bell size={20} />
                                {notificationCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                                        {notificationCount}
                                    </span>
                                )}
                            </button>
                            <NotificationInbox
                                isOpen={isInboxOpen}
                                onClose={() => setIsInboxOpen(false)}
                                onNotificationUpdate={fetchNotificationCount}
                            />
                        </div>

                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-semibold text-gray-700">{user?.name}</span>
                            <span className="text-xs text-gray-500">{user?.email}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-300"
                            title="Logout"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
