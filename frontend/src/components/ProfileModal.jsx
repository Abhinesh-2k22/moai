import React, { useState, useContext, useEffect } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { X, Camera, Save, Loader2, ZoomIn, ZoomOut, Check, ShieldQuestion, ChevronDown, AlertTriangle, ChevronRight, Lock, Eye, EyeOff } from 'lucide-react';
import Avatar from './Avatar';

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

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, updateUser } = useContext(AuthContext);
    const [name, setName] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [profilePicBase64, setProfilePicBase64] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Security question section
    const [sqOpen, setSqOpen] = useState(false);
    const [sqSelectedQuestion, setSqSelectedQuestion] = useState('');
    const [sqCustomQuestion, setSqCustomQuestion] = useState('');
    const [sqAnswer, setSqAnswer] = useState('');
    const [sqSaving, setSqSaving] = useState(false);
    const [sqError, setSqError] = useState('');
    const [sqSuccess, setSqSuccess] = useState('');

    // Change password section
    const [cpOpen, setCpOpen] = useState(false);
    const [cpSecurityAnswer, setCpSecurityAnswer] = useState('');
    const [cpNewPassword, setCpNewPassword] = useState('');
    const [cpConfirmPassword, setCpConfirmPassword] = useState('');
    const [cpShowNew, setCpShowNew] = useState(false);
    const [cpSaving, setCpSaving] = useState(false);
    const [cpError, setCpError] = useState('');
    const [cpSuccess, setCpSuccess] = useState('');

    // Cropper States
    const [isCroppingMode, setIsCroppingMode] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);
    const [cropScale, setCropScale] = useState(1);
    const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
    const [cropImgDimensions, setCropImgDimensions] = useState({ width: 0, height: 0, initW: 0, initH: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPreviewUrl('');
            setProfilePicBase64('');
            setError('');
            setIsCroppingMode(false);
            setImageToCrop(null);
            // Reset security question section on open
            setSqOpen(false);
            setSqSelectedQuestion('');
            setSqCustomQuestion('');
            setSqAnswer('');
            setSqError('');
            setSqSuccess('');
            // Reset change password section on open
            setCpOpen(false);
            setCpSecurityAnswer('');
            setCpNewPassword('');
            setCpConfirmPassword('');
            setCpError('');
            setCpSuccess('');
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Verify it is an image
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        setError('');
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const containerSize = 200;
                let initW, initH;
                if (img.width < img.height) {
                    initW = containerSize;
                    initH = containerSize * (img.height / img.width);
                } else {
                    initH = containerSize;
                    initW = containerSize * (img.width / img.height);
                }

                // Center it initially
                const initialX = (containerSize - initW) / 2;
                const initialY = (containerSize - initH) / 2;

                setCropImgDimensions({
                    width: img.width,
                    height: img.height,
                    initW,
                    initH
                });
                setCropPosition({ x: initialX, y: initialY });
                setCropScale(1);
                setImageToCrop(img);
                setIsCroppingMode(true);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);

        // Reset file input value
        e.target.value = '';
    };

    const handleZoomChange = (e) => {
        const newScale = parseFloat(e.target.value);
        const oldScale = cropScale;
        const containerSize = 200;
        const center = containerSize / 2; // 100

        setCropScale(newScale);
        setCropPosition(prev => {
            let newX = center - (center - prev.x) * (newScale / oldScale);
            let newY = center - (center - prev.y) * (newScale / oldScale);

            const displayedW = cropImgDimensions.initW * newScale;
            const displayedH = cropImgDimensions.initH * newScale;

            const minX = containerSize - displayedW;
            const maxX = 0;
            const minY = containerSize - displayedH;
            const maxY = 0;

            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));

            return { x: newX, y: newY };
        });
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({
            x: e.clientX - cropPosition.x,
            y: e.clientY - cropPosition.y
        });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;

        const containerSize = 200;
        const displayedW = cropImgDimensions.initW * cropScale;
        const displayedH = cropImgDimensions.initH * cropScale;

        const minX = containerSize - displayedW;
        const maxX = 0;
        const minY = containerSize - displayedH;
        const maxY = 0;

        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        setCropPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch support for mobile view
    const handleTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({
            x: touch.clientX - cropPosition.x,
            y: touch.clientY - cropPosition.y
        });
    };

    const handleTouchMove = (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        let newX = touch.clientX - dragStart.x;
        let newY = touch.clientY - dragStart.y;

        const containerSize = 200;
        const displayedW = cropImgDimensions.initW * cropScale;
        const displayedH = cropImgDimensions.initH * cropScale;

        const minX = containerSize - displayedW;
        const maxX = 0;
        const minY = containerSize - displayedH;
        const maxY = 0;

        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        setCropPosition({ x: newX, y: newY });
    };

    const handleCancelCrop = () => {
        setIsCroppingMode(false);
        setImageToCrop(null);
    };

    const handleApplyCrop = () => {
        if (!imageToCrop) return;

        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 128;
        const MAX_HEIGHT = 128;
        canvas.width = MAX_WIDTH;
        canvas.height = MAX_HEIGHT;

        const ctx = canvas.getContext('2d');

        const displayedW = cropImgDimensions.initW * cropScale;
        const displayedH = cropImgDimensions.initH * cropScale;

        // Calculate source rectangle mapping
        const scaleFactor = displayedW / cropImgDimensions.width;

        const sx = -cropPosition.x / scaleFactor;
        const sy = -cropPosition.y / scaleFactor;

        const sWidth = 200 / scaleFactor;
        const sHeight = 200 / scaleFactor;

        ctx.drawImage(
            imageToCrop,
            sx,
            sy,
            sWidth,
            sHeight,
            0,
            0,
            MAX_WIDTH,
            MAX_HEIGHT
        );

        // Compress image to JPEG at 0.6 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setPreviewUrl(compressedBase64);
        setProfilePicBase64(compressedBase64);
        setIsCroppingMode(false);
        setImageToCrop(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const payload = { name: name.trim() };
            if (profilePicBase64) {
                payload.profilePic = profilePicBase64;
            }

            const res = await api.put('/users/profile', payload);

            // Sync context state & localStorage
            updateUser(res.data.user);

            setSaving(false);
            onClose();
            alert('Profile updated successfully!');
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to update profile');
            setSaving(false);
        }
    };

    const isCustomSq = sqSelectedQuestion === "Write my own question...";
    const effectiveSqQuestion = isCustomSq ? sqCustomQuestion.trim() : sqSelectedQuestion;

    const handleSqSubmit = async (e) => {
        e.preventDefault();
        setSqError('');
        setSqSuccess('');

        if (!effectiveSqQuestion) {
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
                securityQuestion: effectiveSqQuestion,
                securityAnswer: sqAnswer.trim()
            });
            updateUser({ hasSecurityQuestion: true, securityQuestion: res.data.securityQuestion });
            setSqSuccess('Security question updated successfully!');
            setSqAnswer('');
            setSqSelectedQuestion('');
            setSqCustomQuestion('');
        } catch (err) {
            setSqError(err.response?.data?.msg || 'Failed to update. Please try again.');
        } finally {
            setSqSaving(false);
        }
    };

    const handleCpSubmit = async () => {
        setCpError('');
        setCpSuccess('');

        if (!cpSecurityAnswer.trim()) {
            setCpError('Please enter your security answer.');
            return;
        }
        if (!cpNewPassword.trim()) {
            setCpError('Please enter a new password.');
            return;
        }
        if (cpNewPassword !== cpConfirmPassword) {
            setCpError('Passwords do not match.');
            return;
        }

        setCpSaving(true);
        try {
            await api.put('/auth/change-password', {
                securityAnswer: cpSecurityAnswer.trim(),
                newPassword: cpNewPassword.trim()
            });
            setCpSuccess('Password changed successfully!');
            setCpSecurityAnswer('');
            setCpNewPassword('');
            setCpConfirmPassword('');
        } catch (err) {
            setCpError(err.response?.data?.msg || 'Failed to change password. Please try again.');
        } finally {
            setCpSaving(false);
        }
    };

    if (isCroppingMode) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800/80 animate-scale-up relative">
                    <button
                        onClick={handleCancelCrop}
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-6 border-b border-gray-150/40 dark:border-slate-800/40">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">Crop Photo</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Drag the photo to position it, or use the slider to zoom</p>
                    </div>

                    <div className="p-6 flex flex-col items-center space-y-6">
                        {/* Crop area viewport */}
                        <div
                            className="relative w-[200px] h-[200px] rounded-full overflow-hidden border-2 border-indigo-500 shadow-lg bg-slate-100 dark:bg-slate-900 cursor-grab active:cursor-grabbing select-none touch-none"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleMouseUp}
                        >
                            <img
                                src={imageToCrop?.src}
                                alt="To crop"
                                className="absolute pointer-events-none origin-top-left"
                                style={{
                                    width: `${cropImgDimensions.initW}px`,
                                    height: `${cropImgDimensions.initH}px`,
                                    transform: `translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${cropScale})`,
                                    maxWidth: 'none',
                                    maxHeight: 'none'
                                }}
                            />
                            {/* Visual circle overlay border */}
                            <div className="absolute inset-0 rounded-full border-2 border-white pointer-events-none mix-blend-difference" />
                        </div>

                        {/* Slider controls */}
                        <div className="w-full space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                                <span className="flex items-center gap-1"><ZoomOut size={14} /> Zoom</span>
                                <span className="flex items-center gap-1">Zoom <ZoomIn size={14} /></span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.01"
                                value={cropScale}
                                onChange={handleZoomChange}
                                className="w-full h-1.5 bg-gray-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 w-full pt-4 border-t border-gray-150/40 dark:border-slate-800/40">
                            <button
                                type="button"
                                onClick={handleCancelCrop}
                                className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl font-semibold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyCrop}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-indigo-500/20 active:scale-98 cursor-pointer"
                            >
                                <Check size={16} />
                                Apply Crop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
            <div className="glass-card w-full max-w-md rounded-2xl shadow-2xl border border-white/20 dark:border-slate-800/80 animate-scale-up relative flex flex-col max-h-[90vh] my-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors z-10"
                >
                    <X size={20} />
                </button>

                {/* Sticky header */}
                <div className="p-6 border-b border-gray-150/40 dark:border-slate-800/40 flex-shrink-0">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Profile Settings</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manage your identity and avatar picture</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                    {error && (
                        <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-950/30 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {/* Avatar Upload Container */}
                    <div className="flex flex-col items-center space-y-3">
                        <div className="relative group">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                                />
                            ) : (
                                <Avatar user={user} size="w-20 h-20" className="border-2 border-indigo-500 shadow-md" />
                            )}
                            <label className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full cursor-pointer shadow-lg hover:scale-110 active:scale-95 transition-all duration-200">
                                <Camera size={14} />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Auto-compressed to 128x128 JPEG to keep size small</p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Full Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Enter your name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email Address</label>
                        <input
                            type="email"
                            disabled
                            value={user?.email || ''}
                            className="w-full px-4 py-2.5 bg-gray-55 dark:bg-slate-850/30 border border-gray-200 dark:border-slate-850 text-gray-400 dark:text-gray-500 rounded-xl outline-none cursor-not-allowed"
                            title="Email cannot be changed"
                        />
                    </div>

                    {/* ── Security Question Section ── */}
                    <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => { setSqOpen(v => !v); setSqError(''); setSqSuccess(''); }}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-900/40 hover:bg-gray-100 dark:hover:bg-slate-800/60 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <ShieldQuestion size={16} className="text-indigo-500 dark:text-indigo-400" />
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Security Question</span>
                                {user?.hasSecurityQuestion && (
                                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">SET</span>
                                )}
                                {!user?.hasSecurityQuestion && (
                                    <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">NOT SET</span>
                                )}
                            </div>
                            <ChevronRight size={16} className={`text-gray-400 transition-transform duration-200 ${sqOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {sqOpen && (
                            <div className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-3">
                                {sqError && (
                                    <div className="p-2.5 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-950/30 text-xs font-medium">
                                        {sqError}
                                    </div>
                                )}
                                {sqSuccess && (
                                    <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-950/30 text-xs font-medium">
                                        {sqSuccess}
                                    </div>
                                )}

                                {/* Question selector */}
                                <div className="relative">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Question</label>
                                    <select
                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 dark:text-white outline-none transition-all appearance-none pr-10 cursor-pointer"
                                        value={sqSelectedQuestion}
                                        onChange={(e) => {
                                            setSqSelectedQuestion(e.target.value);
                                            if (e.target.value !== "Write my own question...") setSqCustomQuestion('');
                                        }}
                                    >
                                        <option value="" disabled>Select a question…</option>
                                        {PRESET_QUESTIONS.map((q) => (
                                            <option key={q} value={q}>{q}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-[calc(50%+10px)] -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>

                                {isCustomSq && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Custom Question</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 dark:text-white outline-none transition-all"
                                            placeholder="e.g. What is your lucky number?"
                                            value={sqCustomQuestion}
                                            onChange={(e) => setSqCustomQuestion(e.target.value)}
                                        />
                                    </div>
                                )}

                                {/* Answer */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Answer</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 dark:text-white outline-none transition-all"
                                        placeholder="One word only"
                                        value={sqAnswer}
                                        onChange={(e) => setSqAnswer(e.target.value.replace(/\s/g, ''))}
                                        autoComplete="off"
                                    />
                                    <div className="flex items-start gap-2 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl px-3 py-2">
                                        <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium leading-snug">
                                            Single word, case-insensitive. This replaces your previous answer.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={handleSqSubmit}
                                        disabled={sqSaving}
                                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
                                    >
                                        {sqSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                        {sqSaving ? 'Saving…' : 'Update Security Question'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Change Password Section ── */}
                    <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => { setCpOpen(v => !v); setCpError(''); setCpSuccess(''); }}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-900/40 hover:bg-gray-100 dark:hover:bg-slate-800/60 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <Lock size={16} className="text-indigo-500 dark:text-indigo-400" />
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Change Password</span>
                            </div>
                            <ChevronRight size={16} className={`text-gray-400 transition-transform duration-200 ${cpOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {cpOpen && (
                            <div className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-3">
                                {cpError && (
                                    <div className="p-2.5 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-950/30 text-xs font-medium">
                                        {cpError}
                                    </div>
                                )}
                                {cpSuccess && (
                                    <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-950/30 text-xs font-medium">
                                        {cpSuccess}
                                    </div>
                                )}

                                {/* Security answer to authenticate */}
                                {user?.securityQuestion && (
                                    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl px-3 py-2.5 mb-1">
                                        <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-0.5">Your Security Question</p>
                                        <p className="text-xs text-gray-800 dark:text-white font-medium">{user.securityQuestion}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Security Answer</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 dark:text-white outline-none transition-all"
                                        placeholder="Your one-word answer"
                                        value={cpSecurityAnswer}
                                        onChange={(e) => setCpSecurityAnswer(e.target.value.replace(/\s/g, ''))}
                                        autoComplete="off"
                                    />
                                    {!user?.securityQuestion && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠ Set a security question first to change your password.</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={cpShowNew ? 'text' : 'password'}
                                            className="w-full px-3 py-2.5 pr-10 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 dark:text-white outline-none transition-all"
                                            placeholder="••••••••"
                                            value={cpNewPassword}
                                            onChange={(e) => setCpNewPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setCpShowNew(v => !v)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                        >
                                            {cpShowNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 dark:text-white outline-none transition-all"
                                        placeholder="••••••••"
                                        value={cpConfirmPassword}
                                        onChange={(e) => setCpConfirmPassword(e.target.value)}
                                    />
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={handleCpSubmit}
                                        disabled={cpSaving || !user?.securityQuestion}
                                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
                                    >
                                        {cpSaving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                                        {cpSaving ? 'Changing…' : 'Change Password'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-150/40 dark:border-slate-800/40">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl font-semibold transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-indigo-500/20 active:scale-98 cursor-pointer"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileModal;
