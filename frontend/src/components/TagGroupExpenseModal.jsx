import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import CategoryDropdown from './CategoryDropdown';
import { AuthContext } from '../context/AuthContext';
import { X } from 'lucide-react';

const TagGroupExpenseModal = ({ isOpen, onClose, expense, groupId, existingMeta, onSaved }) => {
    const { user } = useContext(AuthContext);
    const [category, setCategory] = useState('');
    const [paymentMethodId, setPaymentMethodId] = useState('');
    const [categories, setCategories] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(false);

    const isPayerMe = expense && user && (
        expense.payerId === user.id || 
        (expense.payerId && expense.payerId._id === user.id)
    );

    useEffect(() => {
        if (isOpen) {
            fetchData();
            setCategory(existingMeta?.category || '');
            setPaymentMethodId(existingMeta?.paymentMethodId || '');
        }
    }, [isOpen, existingMeta]);

    const fetchData = async () => {
        try {
            const [catRes, pmRes] = await Promise.all([
                api.get('/categories'),
                api.get('/payment-methods/ensure-defaults')
            ]);
            setCategories(catRes.data.filter(c => c.type === 'expense'));
            setPaymentMethods(pmRes.data);
            if (!existingMeta?.paymentMethodId) {
                const unspecified = pmRes.data.find(m => m.name === 'Unspecified');
                if (unspecified) setPaymentMethodId(unspecified._id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const pm = paymentMethods.find(m => m._id === paymentMethodId);
            await api.put(`/groups/${groupId}/expenses/${expense._id}/meta`, {
                category: category || undefined,
                paymentMethodId: paymentMethodId || undefined,
                paymentMethodName: pm?.name || 'Unspecified'
            });
            onSaved();
            onClose();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to save tags');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !expense) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-slate-800/80 animate-scale-up">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Tag for My Ledger</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"><X size={20} /></button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Only you see this category and payment method for &quot;{expense.description}&quot;</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Category</label>
                        <CategoryDropdown
                            categories={categories}
                            value={category}
                            onChange={setCategory}
                            type="expense"
                            allowFavoriteToggle={false}
                        />
                    </div>
                    {isPayerMe && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Payment Method</label>
                            <select
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                                value={paymentMethodId}
                                onChange={(e) => setPaymentMethodId(e.target.value)}
                            >
                                {paymentMethods.map(pm => (
                                    <option key={pm._id} value={pm._id} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">{pm.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer transition-all shadow-md dark:shadow-none"
                    >
                        {loading ? 'Saving...' : 'Save Tags'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TagGroupExpenseModal;
