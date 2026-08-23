import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Landmark, ArrowRight, ChevronDown, AlertTriangle, ShieldQuestion } from 'lucide-react';

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

const Register = () => {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedQuestion, setSelectedQuestion] = useState('');
    const [customQuestion, setCustomQuestion] = useState('');
    const [securityAnswer, setSecurityAnswer] = useState('');
    const { register } = useContext(AuthContext);
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const isCustom = selectedQuestion === "Write my own question...";
    const effectiveQuestion = isCustom ? customQuestion.trim() : selectedQuestion;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!effectiveQuestion) {
            setError('Please select or write a security question.');
            return;
        }

        const answerWords = securityAnswer.trim().split(/\s+/);
        if (answerWords.length > 1) {
            setError('Security answer must be a single word.');
            return;
        }

        if (!securityAnswer.trim()) {
            setError('Please provide a security answer.');
            return;
        }

        try {
            await register(name, email, password, username, effectiveQuestion, securityAnswer.trim());
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.msg || 'Registration failed. Try again.');
        }
    };

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Left Side - Form */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-8 animate-fade-in overflow-y-auto">
                <div className="max-w-md w-full py-8">
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-indigo-600 p-2 rounded-lg text-white flex items-center justify-center">
                                <Landmark size={24} />
                            </div>
                            <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Moai Finance</span>
                        </div>
                        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Create an account</h2>
                        <p className="text-gray-500 dark:text-gray-400">Start your journey to financial freedom.</p>
                    </div>

                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 p-4 rounded-xl mb-6 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                placeholder="johndoe123"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email address</label>
                            <input
                                type="email"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                            <input
                                type="password"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {/* Security Question divider */}
                        <div className="border-t border-gray-200 dark:border-slate-800 pt-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="bg-indigo-100 dark:bg-indigo-950/50 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <ShieldQuestion size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Security Question</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Used to recover your password if you forget it</p>
                                </div>
                            </div>

                            {/* Question Selector */}
                            <div className="space-y-3">
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Choose a question</label>
                                    <select
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all appearance-none pr-10 cursor-pointer"
                                        value={selectedQuestion}
                                        onChange={(e) => {
                                            setSelectedQuestion(e.target.value);
                                            if (e.target.value !== "Write my own question...") setCustomQuestion('');
                                        }}
                                        required
                                    >
                                        <option value="" disabled>Select a security question…</option>
                                        {PRESET_QUESTIONS.map((q) => (
                                            <option key={q} value={q}>{q}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-[calc(50%+8px)] -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>

                                {/* Custom question input */}
                                {isCustom && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your custom question</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                            placeholder="e.g. What is your lucky number?"
                                            value={customQuestion}
                                            onChange={(e) => setCustomQuestion(e.target.value)}
                                            required={isCustom}
                                        />
                                    </div>
                                )}

                                {/* Answer input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Your answer
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                        placeholder="One word only (e.g. Fluffy)"
                                        value={securityAnswer}
                                        onChange={(e) => setSecurityAnswer(e.target.value.replace(/\s/g, ''))}
                                        required
                                        autoComplete="off"
                                    />
                                    {/* Warning banner */}
                                    <div className="flex items-start gap-2 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl px-3 py-2.5">
                                        <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-snug">
                                            Use a <strong>single word</strong> you will always remember exactly — this is the only way to recover your password. The answer is case-insensitive.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 group cursor-pointer"
                        >
                            Create Account
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-600 dark:text-gray-400">
                            Already have an account?{' '}
                            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Image/Gradient */}
            <div className="hidden md:block w-1/2 bg-indigo-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-700 to-indigo-600 opacity-90"></div>
                <div className="absolute inset-0 flex items-center justify-center p-12 text-white z-10">
                    <div className="max-w-lg">
                        {/* Abstract Shapes */}
                        <div className="absolute top-1/4 left-10 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                        <div className="absolute bottom-1/4 right-10 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
