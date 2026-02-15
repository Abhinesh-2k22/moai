import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Edit2, Save, X, StickyNote } from 'lucide-react';
import { format } from 'date-fns';

const Notes = () => {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentNote, setCurrentNote] = useState(null); // If null, adding new. If object, editing.

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
    const getContrastColor = (hexColor) => {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#1f2937' : '#ffffff'; // Gray-800 or White
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

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Notes</h1>
                    <p className="text-gray-500 mt-1">Capture your ideas</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 font-bold"
                >
                    <Plus size={20} />
                    <span className="hidden sm:inline">New Note</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading notes...</div>
            ) : notes.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-gray-100 border-dashed mx-2">
                    <StickyNote size={48} className="mx-auto mb-3 opacity-20" />
                    <p>No notes yet. Create one!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
                    {notes.map(note => {
                        const textColor = getContrastColor(note.color);
                        return (
                            <div
                                key={note._id}
                                className="p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between group min-h-[250px] relative overflow-hidden"
                                style={{ backgroundColor: note.color !== '#ffffff' ? note.color : 'white' }}
                                onClick={() => handleOpenModal(note)}
                            >
                                {/* Dark overlay for hover effect (optional, kept minimal) */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-black/5" />

                                <div className="cursor-pointer">
                                    {note.title && (
                                        <h3 className="font-bold text-lg mb-3 line-clamp-1" style={{ color: textColor }}>{note.title}</h3>
                                    )}
                                    <div className="whitespace-pre-wrap line-clamp-6 text-sm" style={{ color: textColor, opacity: 0.85 }}>
                                        {note.content}
                                    </div>
                                </div>

                                <div className="flex justify-between items-end mt-4 pt-4 border-t border-black/5">
                                    <span className="text-xs font-medium" style={{ color: textColor, opacity: 0.6 }}>
                                        {format(new Date(note.updatedAt || note.date), 'MMM d, yyyy')}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(note._id); }}
                                            className="p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete"
                                            style={{ backgroundColor: textColor === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', color: textColor }}
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
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 overflow-y-auto">
                    <div
                        className="rounded-2xl w-full max-w-lg shadow-2xl transform transition-all scale-100 relative flex flex-col my-8"
                        style={{ backgroundColor: color, minHeight: '300px' }}
                    >
                        {/* Modal Header Actions */}
                        <div className="flex justify-between items-center p-4">
                            <button
                                onClick={handleCloseModal}
                                className="p-2 rounded-full transition-colors opacity-70 hover:opacity-100"
                                style={{ color: getContrastColor(color) }}
                            >
                                <X size={24} />
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-sm flex items-center gap-2"
                                style={{
                                    backgroundColor: getContrastColor(color),
                                    color: color === '#ffffff' || getContrastColor(color) === '#ffffff' ? '#000' : '#fff'
                                    // Invert logic for button to stand out: If bg is dark (text is white), button should be white (text black). 
                                    // If bg is light (text is dark), button should be dark (text white).
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
                                style={{ color: getContrastColor(color) }}
                            />

                            {/* Auto-growing Textarea */}
                            <textarea
                                ref={textareaRef}
                                placeholder="Take a note..."
                                required
                                className="w-full flex-1 bg-transparent border-none focus:ring-0 focus:outline-none p-0 resize-none text-base placeholder-opacity-50"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                style={{ color: getContrastColor(color), minHeight: '150px' }}
                            />

                            {/* Color Picker */}
                            <div className="pt-4 border-t border-black/5">
                                <p className="text-xs font-bold uppercase tracking-wide mb-2 opacity-60" style={{ color: getContrastColor(color) }}>Color</p>
                                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`w-8 h-8 rounded-full border border-black/10 transition-transform flex-shrink-0 ${color === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'}`}
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
