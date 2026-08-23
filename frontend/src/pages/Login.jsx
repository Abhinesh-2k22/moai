import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { Landmark, ArrowRight, ShieldQuestion, AlertTriangle, ChevronDown } from 'lucide-react';
import api from '../api/axios';

const PRESET_QUESTIONS = [
    "What is your childhood nickname?",
    "What is the name of your first pet?",
    "What is the name of the street you grew up on?",
    "What was your first car's model?",
    "What is your mother's maiden name?",
    "What was the name of your elementary school?",
    "What city were you born in?",
    "What is your oldest sibling's middle name?",
    "Write my own question..."
];

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Security question setup modal state
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [sqSelectedQuestion, setSqSelectedQuestion] = useState('');
    const [sqCustomQuestion, setSqCustomQuestion] = useState('');
    const [sqAnswer, setSqAnswer] = useState('');
    const [sqSaving, setSqSaving] = useState(false);
    const [sqError, setSqError] = useState('');

    const { login, updateUser, user } = useContext(AuthContext);
    const navigate = useNavigate();

    if (user && !showSetupModal) {
        return <Navigate to="/" replace />;
    }

    const isCustom = sqSelectedQuestion === "Write my own question...";
    const effectiveQuestion = isCustom ? sqCustomQuestion.trim() : sqSelectedQuestion;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(identifier, password);
            // Read fresh user from storage (login() updates localStorage)
            const storedUser = JSON.parse(localStorage.getItem('user'));
            if (storedUser && !storedUser.hasSecurityQuestion) {
                // Block navigation — show setup modal instead
                setShowSetupModal(true);
            } else {
                navigate('/');
            }
        } catch (err) {
            setError('Invalid credentials');
        }
    };

    const handleSetupSubmit = async (e) => {
        e.preventDefault();
        setSqError('');

        if (!effectiveQuestion) {
            setSqError('Please select or write a security question.');
            return;
        }
        if (!sqAnswer.trim()) {
            setSqError('Please provide an answer.');
            return;
        }

        setSqSaving(true);
        try {
            const res = await api.put('/auth/set-security-question', {
                securityQuestion: effectiveQuestion,
                securityAnswer: sqAnswer.trim()
            });
            // Sync hasSecurityQuestion flag and question text into context/localStorage
            updateUser({ hasSecurityQuestion: true, securityQuestion: res.data.securityQuestion });
            setShowSetupModal(false);
            navigate('/');
        } catch (err) {
            setSqError(err.response?.data?.msg || 'Failed to save. Please try again.');
        } finally {
            setSqSaving(false);
        }
    };

    return (
        <>
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

            {/* ── Security Question Setup Modal (for existing users) ── */}
            {showSetupModal && (
                <div className="fixed inset-0 bg-slate-900/70 dark:bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800/80 animate-scale-up">
                        {/* Modal header */}
                        <div className="p-6 border-b border-gray-150/40 dark:border-slate-800/40">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="bg-amber-100 dark:bg-amber-950/50 p-2 rounded-lg text-amber-600 dark:text-amber-400">
                                    <ShieldQuestion size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Set a Security Question</h3>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-[44px]">
                                We've moved to security question–based password recovery. Please set yours before continuing.
                            </p>
                        </div>

                        <form onSubmit={handleSetupSubmit} className="p-6 space-y-4">
                            {sqError && (
                                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-950/30 text-sm font-medium">
                                    {sqError}
                                </div>
                            )}

                            {/* Question selector */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Security Question</label>
                                <select
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all appearance-none pr-10 cursor-pointer"
                                    value={sqSelectedQuestion}
                                    onChange={(e) => {
                                        setSqSelectedQuestion(e.target.value);
                                        if (e.target.value !== "Write my own question...") setSqCustomQuestion('');
                                    }}
                                    required
                                >
                                    <option value="" disabled>Select a question…</option>
                                    {PRESET_QUESTIONS.map((q) => (
                                        <option key={q} value={q}>{q}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-[calc(50%+10px)] -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>

                            {/* Custom question input */}
                            {isCustom && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Your Custom Question</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                                        placeholder="e.g. What is your lucky number?"
                                        value={sqCustomQuestion}
                                        onChange={(e) => setSqCustomQuestion(e.target.value)}
                                        required={isCustom}
                                    />
                                </div>
                            )}

                            {/* Answer */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Your Answer</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                                    placeholder="One word only (e.g. Fluffy)"
                                    value={sqAnswer}
                                    onChange={(e) => setSqAnswer(e.target.value.replace(/\s/g, ''))}
                                    required
                                    autoComplete="off"
                                />

                                {/* Warning */}
                                <div className="flex items-start gap-2 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl px-3 py-2.5">
                                    <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-snug">
                                        Use a <strong>single word</strong> you will always remember. This is the only way to recover your password. The answer is case-insensitive.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={sqSaving}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-indigo-500/20 cursor-pointer"
                                >
                                    {sqSaving ? "Saving…" : "Save & Continue"}
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Login;
