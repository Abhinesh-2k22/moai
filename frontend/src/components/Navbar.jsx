import React, { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, PieChart, Users, Home, Scale, StickyNote, Wallet } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="glass sticky top-0 z-40 border-b border-gray-200/50">
            <div className="container mx-auto px-2 md:px-4">
                <div className="flex justify-between items-center py-3 md:py-4">
                    <Link to="/" className="flex items-center gap-1 md:gap-2 group">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 md:p-2 rounded-lg text-white shadow-lg group-hover:shadow-indigo-500/30 transition-all duration-300">
                            <Wallet className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <span className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                            MOAI
                        </span>
                    </Link>

                    <div className="flex items-center gap-1 md:gap-6 bg-white/50 px-2 md:px-6 py-1.5 md:py-2 rounded-full border border-white/50 shadow-sm backdrop-blur-md overflow-x-auto hide-scrollbar">
                        <Link
                            to="/"
                            className={`flex items-center gap-2 px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-300 ${isActive('/') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <Home size={18} />
                            <span className="hidden md:inline">Dashboard</span>
                        </Link>
                        <Link
                            to="/analysis"
                            className={`flex items-center gap-2 px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-300 ${isActive('/analysis') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <PieChart size={18} />
                            <span className="hidden md:inline">Analysis</span>
                        </Link>
                        <Link
                            to="/groups"
                            className={`flex items-center gap-2 px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-300 ${isActive('/groups') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <Users size={18} />
                            <span className="hidden md:inline">Groups</span>
                        </Link>
                        <Link
                            to="/settlements"
                            className={`flex items-center gap-2 px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-300 ${isActive('/settlements') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <Scale size={18} />
                            <span className="hidden md:inline">Settlements</span>
                        </Link>
                        <Link
                            to="/notes"
                            className={`flex items-center gap-2 px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-300 ${isActive('/notes') ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}
                        >
                            <StickyNote size={18} />
                            <span className="hidden md:inline">Notes</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-semibold text-gray-700">{user?.name}</span>
                            <span className="text-xs text-gray-500">{user?.email}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 md:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-300"
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
