import React, { useState } from 'react';

const Avatar = ({ user, size = 'w-8 h-8', className = '', onClick = null, title = '' }) => {
    const [imageError, setImageError] = useState(false);

    if (!user) return null;

    const userId = user._id || user.id;
    const hasProfilePic = user.profilePic && user.profilePic.contentType;
    
    // Construct initials
    const initials = user.name
        ? user.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    // API URL base
    const apiBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const cleanBaseURL = apiBaseURL.endsWith('/api') ? apiBaseURL : `${apiBaseURL}/api`;
    const avatarUrl = `${cleanBaseURL}/users/${userId}/avatar`;

    const handleClick = (e) => {
        if (onClick) {
            onClick(e);
        }
    };

    // Determine font size based on avatar size class
    let fontSizeClass = 'text-xs';
    if (size.includes('w-5') || size.includes('w-6') || size.includes('h-5') || size.includes('h-6')) {
        fontSizeClass = 'text-[8px] font-bold';
    } else if (size.includes('w-12') || size.includes('h-12')) {
        fontSizeClass = 'text-base font-bold';
    } else if (size.includes('w-16') || size.includes('h-16')) {
        fontSizeClass = 'text-xl font-bold';
    } else if (size.includes('w-20') || size.includes('h-20')) {
        fontSizeClass = 'text-2xl font-bold';
    }

    if (hasProfilePic && !imageError) {
        return (
            <img
                src={avatarUrl}
                alt={user.name}
                onError={() => setImageError(true)}
                onClick={handleClick}
                title={title || user.name}
                className={`${size} rounded-full object-cover border border-gray-200 dark:border-slate-800/80 transition-all duration-300 ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''} ${className}`}
            />
        );
    }

    // Fallback to initial avatar
    return (
        <div 
            onClick={handleClick}
            title={title || user.name}
            className={`${size} rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center tracking-wider border border-gray-200 dark:border-slate-800/60 shadow-sm transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} ${className}`}
        >
            <span className={`${fontSizeClass} uppercase leading-none`}>{initials}</span>
        </div>
    );
};

export default Avatar;
