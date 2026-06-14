import React, { useState, useEffect, useRef } from 'react';
import { Star, ChevronDown, Check } from 'lucide-react';

const CategoryDropdown = ({ categories, value, onChange, type, placeholder = "Select Category", showAllOption = false, allowFavoriteToggle = true, recents: propRecents = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // Persisted State keys
    const FAV_KEY = `moai_fav_cats_${type || 'general'}`;
    const LRU_KEY = `moai_lru_cats_${type || 'general'}`;

    const [favorites, setFavorites] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
        } catch { return []; }
    });

    // Internal Recents State (for when no prop provided or purely local usage)
    const [localRecents, setLocalRecents] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(LRU_KEY)) || [];
        } catch { return []; }
    });

    // Aggregation Logic for 'All' type
    const TYPES = ['income', 'expense', 'investment', 'lend', 'borrow'];

    // Load favorites
    useEffect(() => {
        try {
            if (type === 'all') {
                // Merge favorites from all types
                let allFavs = [];
                TYPES.forEach(t => {
                    const stored = JSON.parse(localStorage.getItem(`moai_fav_cats_${t}`));
                    if (stored) allFavs = [...allFavs, ...stored];
                });
                setFavorites([...new Set(allFavs)]); // Unique
            } else {
                const stored = JSON.parse(localStorage.getItem(FAV_KEY));
                setFavorites(stored || []);
            }
        } catch {
            setFavorites([]);
        }
    }, [type, FAV_KEY]);

    useEffect(() => {
        // Only save back if NOT 'all' (Analysis view shouldn't write to 'all' key normally, or if it does, handle carefully)
        // Since toggle is disabled in Analysis for now, this is safe. 
        // But if enabled later, we must ensure we don't overwrite specific type data with generic data.
        if (type !== 'all' && favorites.length > 0) {
            localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
        }
    }, [favorites, FAV_KEY, type]);

    // Load Recents (LRU) - Renamed setRecents to setLocalRecents
    useEffect(() => {
        try {
            if (type === 'all') {
                let allRecents = [];
                TYPES.forEach(t => {
                    const stored = JSON.parse(localStorage.getItem(`moai_lru_cats_${t}`));
                    if (stored) allRecents = [...allRecents, ...stored];
                });
                setLocalRecents([...new Set(allRecents)]);
            } else {
                const stored = JSON.parse(localStorage.getItem(LRU_KEY));
                setLocalRecents(stored || []);
            }
        } catch {
            setLocalRecents([]);
        }
    }, [type, LRU_KEY]);

    useEffect(() => {
        if (type !== 'all' && localRecents.length > 0) {
            localStorage.setItem(LRU_KEY, JSON.stringify(localRecents));
        }
    }, [localRecents, LRU_KEY, type]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleFavorite = (e, catName) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        setFavorites(prev => {
            const newFavs = prev.includes(catName)
                ? prev.filter(f => f !== catName)
                : [...prev, catName];
            return newFavs;
        });
    };

    const handleSelect = (catName) => {
        onChange(catName);
        setIsOpen(false);
        setSearchTerm('');

        // Update LOCAL LRU regardless
        if (catName && catName !== 'all' && type !== 'all') {
            const newRecents = [catName, ...localRecents.filter(r => r !== catName)].slice(0, 5);
            setLocalRecents(newRecents);
            localStorage.setItem(LRU_KEY, JSON.stringify(newRecents));
        }
    };

    // Sorting Logic
    const sortedCategories = [...categories].sort((a, b) => {
        const isFavA = favorites.includes(a.name);
        const isFavB = favorites.includes(b.name);

        // 1. Favorites First
        if (isFavA && !isFavB) return -1;
        if (!isFavA && isFavB) return 1;

        // 2. Recents Second (Prioritize Prop Recents if available, else Local)
        const effectiveRecents = propRecents.length > 0 ? propRecents : localRecents;

        const recentIndexA = effectiveRecents.indexOf(a.name);
        const recentIndexB = effectiveRecents.indexOf(b.name);

        if (recentIndexA !== -1 && recentIndexB !== -1) return recentIndexA - recentIndexB;
        if (recentIndexA !== -1) return -1;
        if (recentIndexB !== -1) return 1;

        // 3. Alphabetical
        return a.name.localeCompare(b.name);
    });

    // Determine display label
    let displayLabel = placeholder;
    if (value === 'all' && showAllOption) displayLabel = "All Categories";
    else if (value) displayLabel = value;

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-955 outline-none transition-all flex justify-between items-center text-left cursor-pointer text-gray-800 dark:text-white"
            >
                <span className={`block truncate text-base ${!value ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white'}`}>
                    {displayLabel}
                </span>
                <ChevronDown size={24} className="text-gray-400 dark:text-gray-500" />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl overflow-y-auto overflow-x-hidden max-h-[300px]"
                    style={{ zIndex: 100 }}
                >
                    <div className="py-1">
                        {showAllOption && (
                            <div
                                onClick={() => handleSelect('all')}
                                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between group transition-colors"
                            >
                                <span className={`font-medium ${value === 'all' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                    All Categories
                                </span>
                                {value === 'all' && <Check size={16} className="text-indigo-600 dark:text-indigo-400" />}
                            </div>
                        )}

                        {sortedCategories.length === 0 && !showAllOption ? (
                            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">No categories found</div>
                        ) : (
                            sortedCategories.map((cat) => (
                                <div
                                    key={cat._id}
                                    onClick={() => handleSelect(cat.name)}
                                    className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between group transition-colors"
                                >
                                    <span className={`font-medium truncate pr-8 ${value === cat.name ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                        {cat.name}
                                    </span>

                                    <div className="flex items-center gap-2">
                                        {value === cat.name && <Check size={16} className="text-indigo-600 dark:text-indigo-400" />}

                                        {/* Only show Star if allowed */}
                                        {allowFavoriteToggle && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(e, cat.name);
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                className={`p-1 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors relative z-10 ${favorites.includes(cat.name)
                                                    ? 'text-yellow-400 fill-yellow-400'
                                                    : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400 dark:hover:text-yellow-400'
                                                    }`}
                                                title={favorites.includes(cat.name) ? "Remove from favorites" : "Add to favorites"}
                                            >
                                                <Star size={18} className={favorites.includes(cat.name) ? "fill-current" : ""} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryDropdown;
