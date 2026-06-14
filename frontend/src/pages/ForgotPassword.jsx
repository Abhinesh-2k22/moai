import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Landmark, ArrowRight, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

const ForgotPassword = () => {
    const [step, setStep] = useState(1); // 1 = request, 2 = reset, 3 = success
    const [identifier, setIdentifier] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        if (!identifier.trim()) return;

        setLoading(true);
        setError('');
        setMessage('');

        try {
            await api.post('/auth/forgot-password', { identifier: identifier.trim() });
            setMessage('Verification code sent! Please check your inbox (and check your spam folder for an email from Moai Finance if you do not see it).');
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to request OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!otp.trim() || !newPassword.trim() || !confirmPassword.trim()) return;

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const res = await api.post('/auth/reset-password', {
                identifier: identifier.trim(),
                otp: otp.trim(),
                newPassword: newPassword.trim()
            });
            setMessage(res.data.msg || 'Password reset successful!');
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.msg || 'Invalid or expired OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Form Side */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-8 animate-fade-in">
                <div className="max-w-md w-full">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-indigo-600 p-2 rounded-lg text-white flex items-center justify-center">
                                <Landmark size={24} />
                            </div>
                            <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Moai Finance</span>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Reset password</h2>
                        <p className="text-gray-500 dark:text-gray-400">
                            {step === 1 && "Enter your email or username to request a 6-digit verification code."}
                            {step === 2 && "Enter the verification code sent to your email and choose a new password."}
                            {step === 3 && "Your password has been successfully reset."}
                        </p>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 p-4 rounded-xl mb-6 text-sm font-medium flex items-start gap-2.5">
                            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {message && step !== 3 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl mb-6 text-sm font-medium flex items-start gap-2.5">
                            <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                            <span>{message}</span>
                        </div>
                    )}

                    {/* Step 1: Request OTP Form */}
                    {step === 1 && (
                        <form onSubmit={handleRequestOtp} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email or Username</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                    placeholder="Enter your email or username"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 group cursor-pointer"
                            >
                                {loading ? "Sending..." : "Send Verification Code"}
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </form>
                    )}

                    {/* Step 2: Reset Password Form */}
                    {step === 2 && (
                        <form onSubmit={handleResetPassword} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Code (OTP)</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all tracking-widest text-center font-bold text-lg"
                                    placeholder="••••••"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 group cursor-pointer"
                            >
                                {loading ? "Updating..." : "Reset Password"}
                                <KeyRound size={18} />
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="w-full text-center text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:underline transition-colors mt-2"
                            >
                                Back to Step 1
                            </button>
                        </form>
                    )}

                    {/* Step 3: Success View */}
                    {step === 3 && (
                        <div className="space-y-6 text-center">
                            <div className="flex justify-center">
                                <div className="bg-emerald-100 dark:bg-emerald-950/40 p-4 rounded-full text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={48} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Password changed!</h3>
                                <p className="text-gray-500 dark:text-gray-400">Your password has been reset successfully. You can now use your new password to sign in to your account.</p>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                Back to sign in
                            </button>
                        </div>
                    )}

                    {/* Footer */}
                    {step !== 3 && (
                        <div className="mt-8 text-center">
                            <p className="text-gray-600 dark:text-gray-400">
                                Remember your password?{' '}
                                <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Decorative Side */}
            <div className="hidden md:block w-1/2 bg-indigo-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 opacity-90"></div>
                <div className="absolute inset-0 flex items-center justify-center p-12 text-white z-10">
                    <div className="max-w-lg">
                        {/* Abstract blobs */}
                        <div className="absolute top-1/4 right-10 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                        <div className="absolute bottom-1/4 left-10 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
