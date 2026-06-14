import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { Landmark, ArrowRight } from 'lucide-react';

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const { user } = useContext(AuthContext);

    if (user) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(identifier, password);
            navigate('/');
        } catch (err) {
            setError('Invalid credentials');
        }
    };

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Left Side - Form */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-8 animate-fade-in">
                <div className="max-w-md w-full">
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-indigo-600 p-2 rounded-lg text-white flex items-center justify-center">
                                <Landmark size={24} />
                            </div>
                            <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Moai Finance</span>
                        </div>
                        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Welcome back</h2>
                        <p className="text-gray-500 dark:text-gray-400">Please enter your details to sign in.</p>
                    </div>

                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 p-4 rounded-xl mb-6 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email or Username</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                placeholder="Enter your email or username"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                <Link to="/forgot-password" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <input
                                type="password"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 group cursor-pointer"
                        >
                            Sign in
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-600 dark:text-gray-400">
                            Don't have an account?{' '}
                            <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline">
                                Sign up for free
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Image/Gradient */}
            <div className="hidden md:block w-1/2 bg-indigo-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 opacity-90"></div>
                <div className="absolute inset-0 flex items-center justify-center p-12 text-white z-10">
                    <div className="max-w-lg">


                        {/* Abstract Shapes */}
                        <div className="absolute top-1/4 right-10 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                        <div className="absolute bottom-1/4 left-10 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;

