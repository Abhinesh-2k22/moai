import React, { useState, useEffect, useRef, useContext } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Edit2, Save, X, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { ThemeContext } from '../context/ThemeContext';

const Notes = () => {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentNote, setCurrentNote] = useState(null); // If null, adding new. If object, editing.
    const { theme } = useContext(ThemeContext);

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('#f28b82');

    // Textarea auto-resize ref
    const textareaRef = useRef(null);

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const res = await api.get('/notes');
            setNotes(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (isModalOpen && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content, isModalOpen]);

    // Contrast Helper
    const getNoteColors = (hexColor, currentTheme) => {
        if (!hexColor || hexColor === '#ffffff') {
            return {
                bgClass: 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800',
                bgStyle: {},
                textColor: currentTheme === 'dark' ? '#f8fafc' : '#1f2937',
                borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                buttonBg: currentTheme === 'dark' ? '#f8fafc' : '#1f2937',
                buttonText: currentTheme === 'dark' ? '#0f172a' : '#ffffff'
            };
        }

        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        const textColor = yiq >= 128 ? '#1f2937' : '#ffffff';

        return {
            bgClass: 'border border-black/5',
            bgStyle: { backgroundColor: hexColor },
            textColor: textColor,
            borderColor: 'rgba(0,0,0,0.05)',
            buttonBg: textColor,
            buttonText: textColor === '#ffffff' ? '#1f2937' : '#ffffff'
        };
    };

    const handleOpenModal = (note = null) => {
        if (note) {
            setCurrentNote(note);
            setTitle(note.title);
            setContent(note.content);
            setColor(note.color);
        } else {
            setCurrentNote(null);
            setTitle('');
            setContent('');
            setColor('#f28b82');
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentNote(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentNote) {
                // Edit
                const res = await api.put(`/notes/${currentNote._id}`, { title, content, color });
                setNotes(notes.map(n => n._id === currentNote._id ? res.data : n));
            } else {
                // Add
                const res = await api.post('/notes', { title, content, color });
                setNotes([res.data, ...notes]);
            }
            handleCloseModal();
        } catch (err) {
            console.error(err);
            alert('Failed to save note');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this note?')) return;
        try {
            await api.delete(`/notes/${id}`);
            setNotes(notes.filter(n => n._id !== id));
        } catch (err) {
            console.error(err);
            alert('Failed to delete note');
        }
    };

    const colors = ['#f28b82', '#fbbc04', '#fff475', '#ccff90', '#a7ffeb', '#cbf0f8', '#aecbfa', '#d7aefb', '#fdcfe8', '#e6c9a8'];

    const modalColors = isModalOpen ? getNoteColors(color, theme) : null;

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Notes</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Capture your ideas</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none font-bold cursor-pointer"
                >
                    <Plus size={20} />
                    <span className="hidden sm:inline">New Note</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading notes...</div>
            ) : notes.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800 border-dashed mx-2">
                    <StickyNote size={48} className="mx-auto mb-3 opacity-20" />
                    <p>No notes yet. Create one!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
                    {notes.map(note => {
                        const noteColorsConfig = getNoteColors(note.color, theme);
                        return (
                            <div
                                key={note._id}
                                className={`p-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between group min-h-[250px] relative overflow-hidden cursor-pointer ${noteColorsConfig.bgClass}`}
                                style={noteColorsConfig.bgStyle}
                                onClick={() => handleOpenModal(note)}
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-black/5" />

                                <div>
                                    {note.title && (
                                        <h3 className="font-bold text-lg mb-3 line-clamp-1" style={{ color: noteColorsConfig.textColor }}>{note.title}</h3>
                                    )}
                                    <div className="whitespace-pre-wrap line-clamp-6 text-sm font-normal" style={{ color: noteColorsConfig.textColor, opacity: 0.85 }}>
                                        {note.content}
                                    </div>
                                </div>

                                <div className="flex justify-between items-end mt-4 pt-4" style={{ borderColor: noteColorsConfig.borderColor, borderTopWidth: '1px' }}>
                                    <span className="text-xs font-medium" style={{ color: noteColorsConfig.textColor, opacity: 0.6 }}>
                                        {format(new Date(note.updatedAt || note.date), 'MMM d, yyyy')}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(note._id); }}
                                            className="p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                                            title="Delete"
                                            style={{ color: noteColorsConfig.textColor }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && modalColors && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 overflow-y-auto">
                    <div
                        className={`rounded-2xl w-full max-w-lg shadow-2xl transform transition-all scale-100 relative flex flex-col my-8 min-h-[300px] ${modalColors.bgClass}`}
                        style={modalColors.bgStyle}
                    >
                        {/* Modal Header Actions */}
                        <div className="flex justify-between items-center p-4">
                            <button
                                onClick={handleCloseModal}
                                className="p-2 rounded-full transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                                style={{ color: modalColors.textColor }}
                            >
                                <X size={24} />
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                                style={{
                                    backgroundColor: modalColors.buttonBg,
                                    color: modalColors.buttonText
                                }}
                            >
                                <Save size={16} />
                                Save
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 pt-0 space-y-4">
                            <input
                                type="text"
                                placeholder="Title"
                                className="w-full bg-transparent text-xl font-bold border-none focus:ring-0 focus:outline-none p-0 placeholder-opacity-50"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={{ color: modalColors.textColor }}
                            />

                            {/* Auto-growing Textarea */}
                            <textarea
                                ref={textareaRef}
                                placeholder="Take a note..."
                                required
                                className="w-full flex-1 bg-transparent border-none focus:ring-0 focus:outline-none p-0 resize-none text-base placeholder-opacity-50"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                style={{ color: modalColors.textColor, minHeight: '150px' }}
                            />

                            {/* Color Picker */}
                            <div className="pt-4" style={{ borderColor: modalColors.borderColor, borderTopWidth: '1px' }}>
                                <p className="text-xs font-bold uppercase tracking-wide mb-2 opacity-60" style={{ color: modalColors.textColor }}>Color</p>
                                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`w-8 h-8 rounded-full border border-black/10 transition-transform flex-shrink-0 ${color === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'} cursor-pointer`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notes;
