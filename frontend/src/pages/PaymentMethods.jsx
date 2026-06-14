import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Edit2, CreditCard, X } from 'lucide-react';

const TYPE_LABELS = {
    card: 'Debit/Credit Card',
    upi: 'UPI App',
    cash: 'Cash',
    other: 'Other'
};

const PaymentMethods = () => {
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [name, setName] = useState('');
    const [type, setType] = useState('card');

    useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        try {
            const res = await api.get('/payment-methods/ensure-defaults');
            setMethods(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (method = null) => {
        if (method) {
            setEditing(method);
            setName(method.name);
            setType(method.type);
        } else {
            setEditing(null);
            setName('');
            setType('card');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditing(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editing) {
                await api.put(`/payment-methods/${editing._id}`, { name, type });
            } else {
                await api.post('/payment-methods', { name, type });
            }
            fetchMethods();
            closeModal();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to save payment method');
        }
    };

    const handleDelete = async (id, methodName) => {
        if (methodName === 'Unspecified') {
            alert('Cannot delete the default Unspecified method');
            return;
        }
        if (!window.confirm('Delete this payment method?')) return;
        try {
            await api.delete(`/payment-methods/${id}`);
            fetchMethods();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to delete');
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
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Payment Methods</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Label-only names for cards, UPI apps, and cash — no sensitive details stored</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg dark:shadow-none cursor-pointer font-bold"
                >
                    <Plus size={20} />
                    Add Method
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
                {methods.map((method) => (
                    <div key={method._id} className="glass-card p-5 rounded-xl border border-gray-150 dark:border-slate-800/80">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                    <CreditCard size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white">{method.name}</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{TYPE_LABELS[method.type] || method.type}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => openModal(method)} className="p-2 text-gray-450 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg cursor-pointer">
                                    <Edit2 size={16} />
                                </button>
                                {method.name !== 'Unspecified' && (
                                    <button onClick={() => handleDelete(method._id, method.name)} className="p-2 text-gray-455 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg cursor-pointer">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-slate-800/80 animate-scale-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editing ? 'Edit' : 'Add'} Payment Method</h2>
                            <button onClick={closeModal} className="p-2 text-gray-400 dark:text-gray-550 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="HDFC Debit, PhonePe..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Type</label>
                                <select
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                >
                                    <option value="card">Debit/Credit Card</option>
                                    <option value="upi">UPI App</option>
                                    <option value="cash">Cash</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md dark:shadow-none cursor-pointer">
                                {editing ? 'Save Changes' : 'Add Method'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentMethods;
