import React, { useState, useContext, useEffect } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { X, Camera, Save, Loader2, ZoomIn, ZoomOut, Check } from 'lucide-react';
import Avatar from './Avatar';

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, updateUser } = useContext(AuthContext);
    const [name, setName] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [profilePicBase64, setProfilePicBase64] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

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
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800/80 animate-scale-up relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="p-6 border-b border-gray-150/40 dark:border-slate-800/40">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Profile Settings</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manage your identity and avatar picture</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
