import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Edit2, UserCircle, X } from 'lucide-react';

const Contacts = () => {
    const [contacts, setContacts] = useState([]);
    const [balances, setBalances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            const [contactsRes, balancesRes] = await Promise.all([
                api.get('/users/dummy'),
                api.get('/settlements/contacts')
            ]);
            setContacts(contactsRes.data);
            setBalances(balancesRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (contact = null) => {
        if (contact) {
            setEditingContact(contact);
            setName(contact.name);
            setDescription(contact.description || '');
        } else {
            setEditingContact(null);
            setName('');
            setDescription('');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingContact(null);
        setName('');
        setDescription('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingContact) {
                await api.put(`/users/dummy/${editingContact._id}`, { name, description });
            } else {
                await api.post('/users/dummy', { name, description });
            }
            fetchContacts();
            closeModal();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save contact');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this contact?')) return;
        try {
            await api.delete(`/users/dummy/${id}`);
            fetchContacts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete contact');
        }
    };

    const handleSettle = async (contact, balanceItem) => {
        if (!window.confirm(`Settle all balances between ${contact.name} and ${balanceItem.name}?`)) return;
        try {
            await api.post('/settlements/settle-contact', {
                dummyId: contact._id,
                guestName: contact.name,
                otherUserId: balanceItem.userId,
                otherGuestName: balanceItem.userId ? null : balanceItem.name
            });
            fetchContacts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to settle balances');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Contacts</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Track people outside the app for lend/borrow and group expenses</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl transition-all shadow-lg cursor-pointer"
                >
                    <Plus size={20} />
                    Add Contact
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact) => (
                    <div key={contact._id} className="glass-card p-5 rounded-xl border border-gray-100 dark:border-slate-800/80">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <UserCircle size={28} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white">{contact.name}</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-550">Offline contact</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => openModal(contact)}
                                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg cursor-pointer"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(contact._id)}
                                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        {contact.description && (
                            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-900/60 p-3 rounded-lg">{contact.description}</p>
                        )}
                        {(() => {
                            const contactData = balances.find(b => b.contact._id === contact._id);
                            if (!contactData || !contactData.balancesWithOthers || contactData.balancesWithOthers.length === 0) return null;
                            
                            return (
                                <div className="mt-4 space-y-2">
                                    {contactData.balancesWithOthers.map((b, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-900/60 rounded-lg flex justify-between items-center border border-gray-100 dark:border-slate-800">
                                            <div>
                                                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{b.name}</span>
                                                <div className={`font-bold ${b.total > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {b.total > 0 ? 'Owes them' : 'They owe'} ₹{Math.abs(b.total).toFixed(2)}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleSettle(contact, b)}
                                                className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 dark:hover:bg-indigo-900/60 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                                            >
                                                Settle Up
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                ))}
                {contacts.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50/20 dark:bg-slate-900/20 rounded-xl border border-dashed border-gray-200 dark:border-slate-800/80">
                        No contacts yet. Add someone like a friend who is not on Moai.
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                {editingContact ? 'Edit Contact' : 'Add Contact'}
                            </h2>
                            <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full cursor-pointer text-gray-500 dark:text-gray-400">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Justin"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Description (optional)</label>
                                <textarea
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="College friend, owes me for trip..."
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                            >
                                {editingContact ? 'Save Changes' : 'Add Contact'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
