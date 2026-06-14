import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { X, Check } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import CategoryDropdown from './CategoryDropdown';

const AddTransactionModal = ({ isOpen, onClose, onTransactionAdded, recentCategories = [] }) => {
    const { user } = useContext(AuthContext);
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('expense');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });



    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [investmentType, setInvestmentType] = useState('buy');

    // Lend/Borrow specific states
    const [users, setUsers] = useState([]);
    const [dummyUsers, setDummyUsers] = useState([]);
    const [recipientInput, setRecipientInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedRecipient, setSelectedRecipient] = useState(null); // {id, name, type: 'user'|'dummy' }
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [paymentMethodId, setPaymentMethodId] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchPaymentMethods();
            if (type === 'lend' || type === 'borrow') {
                fetchUsers();
                fetchDummyUsers();
            }
        }
    }, [isOpen, type]);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            setCategories(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchDummyUsers = async () => {
        try {
            const res = await api.get('/users/dummy');
            setDummyUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchPaymentMethods = async () => {
        try {
            const res = await api.get('/payment-methods/ensure-defaults');
            setPaymentMethods(res.data);
            const unspecified = res.data.find(m => m.name === 'Unspecified');
            if (unspecified) setPaymentMethodId(unspecified._id);
        } catch (err) {
            console.error(err);
        }
    };

    // Filter suggestions based on input
    const getSuggestions = () => {
        if (!recipientInput) return [];

        const query = recipientInput.toLowerCase();
        const userSuggestions = users
            .filter(u => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
            .map(u => ({ id: u._id, name: `${u.name} (${u.email})`, type: 'user', displayName: u.name }));

        const dummySuggestions = dummyUsers
            .filter(d => d.name.toLowerCase().includes(query))
            .map(d => ({ id: d._id, name: d.name, type: 'dummy', displayName: d.name }));

        return [...userSuggestions, ...dummySuggestions];
    };

    const handleRecipientSelect = (suggestion) => {
        setSelectedRecipient(suggestion);
        setRecipientInput(suggestion.displayName || suggestion.name);
        setShowSuggestions(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                amount: Number(amount),
                type,
                description,
                date
            };

            // Add type-specific fields
            if (type === 'investment') {
                payload.investmentType = investmentType;
                payload.category = category;
            } else if (type === 'lend' || type === 'borrow') {
                // If user typed a name that doesn't match any existing user/dummy, create dummy user
                if (!selectedRecipient && recipientInput.trim()) {
                    const lowerInput = recipientInput.trim().toLowerCase();
                    const existingUser = users.find(u => u.name.toLowerCase() === lowerInput || u.email.toLowerCase() === lowerInput);
                    const existingDummy = dummyUsers.find(d => d.name.toLowerCase() === lowerInput);

                    if (existingUser) {
                        payload.recipientUserId = existingUser._id;
                    } else if (existingDummy) {
                        payload.recipientDummyId = existingDummy._id;
                    } else {
                        // Create dummy user first
                        const dummyRes = await api.post('/users/dummy', { name: recipientInput.trim() });
                        payload.recipientDummyId = dummyRes.data._id;
                    }
                } else if (selectedRecipient) {
                    if (selectedRecipient.type === 'user') {
                        payload.recipientUserId = selectedRecipient.id;
                    } else {
                        payload.recipientDummyId = selectedRecipient.id;
                    }
                } else {
                    alert('Please enter a recipient name');
                    return;
                }

                // Enforce naming convention: [Lender]: Lent to [Borrower]
                const recipientName = selectedRecipient ? (selectedRecipient.displayName || selectedRecipient.name) : recipientInput;

                if (recipientName && user && user.name) {
                    const otherName = recipientName.split('(')[0].trim();
                    const myName = user.name;

                    let prefix = '';
                    let defaultAction = '';

                    if (type === 'lend') {
                        // I am lending. I am the lender.
                        prefix = myName;
                        defaultAction = `Lent to ${otherName}`;
                    } else {
                        // I am borrowing. Recipient is the lender.
                        prefix = otherName;
                        defaultAction = `Lent to ${myName}`;
                    }

                    // Format: "Lender: Description"
                    if (description) {
                        // Avoid double prefixing if user already typed it
                        if (!description.toLowerCase().startsWith(prefix.toLowerCase())) {
                            payload.description = `${prefix}: ${description}`;
                        }
                    } else {
                        payload.description = `${prefix}: ${defaultAction}`;
                    }
                }
            } else {
                payload.category = category;
            }

            if (type !== 'lend' && type !== 'borrow' && paymentMethodId) {
                const pm = paymentMethods.find(m => m._id === paymentMethodId);
                payload.paymentMethodId = paymentMethodId;
                payload.paymentMethodName = pm?.name || 'Unspecified';
            }

            await api.post('/transactions', payload);
            onTransactionAdded();
            onClose();
            resetForm();
        } catch (err) {
            console.error(err);
            alert('Failed to add transaction');
        }
    };

    const handleAddCategory = async () => {
        if (!newCategory) return;
        try {
            const res = await api.post('/categories', { name: newCategory, type });
            setCategories([...categories, res.data]);
            setCategory(newCategory);
            setNewCategory('');
            setIsAddingCategory(false);
        } catch (err) {
            console.error(err);
        }
    };

    const resetForm = () => {
        setAmount('');
        setType('expense');
        setCategory('');
        setDescription('');
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setDate(now.toISOString().slice(0, 16));
        setRecipientInput('');
        setSelectedRecipient(null);
        setShowSuggestions(false);
    };

    if (!isOpen) return null;

    const filteredCategories = categories.filter(c => c.type === type);
    const isLendBorrow = type === 'lend' || type === 'borrow';
    const suggestions = getSuggestions();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100 max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-slate-800/80">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Transaction</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500 dark:text-gray-450 cursor-pointer">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-slate-950 rounded-xl">
                        <button
                            type="button"
                            className={`py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${type === 'expense' ? 'bg-white dark:bg-slate-800 text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            onClick={() => setType('expense')}
                        >
                            Expense
                        </button>
                        <button
                            type="button"
                            className={`py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${type === 'income' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            onClick={() => setType('income')}
                        >
                            Income
                        </button>
                        <button
                            type="button"
                            className={`py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${type === 'investment' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            onClick={() => setType('investment')}
                        >
                            Investment
                        </button>
                        <button
                            type="button"
                            className={`py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${type === 'lend' ? 'bg-white dark:bg-slate-800 text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            onClick={() => setType('lend')}
                        >
                            Lend
                        </button>
                        <button
                            type="button"
                            className={`col-span-2 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${type === 'borrow' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            onClick={() => setType('borrow')}
                        >
                            Borrow
                        </button>
                    </div>

                    {/* Investment Type */}
                    {type === 'investment' && (
                        <div className="flex p-1 bg-gray-100 dark:bg-slate-950 rounded-xl">
                            <button
                                type="button"
                                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${investmentType === 'buy' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                                onClick={() => setInvestmentType('buy')}
                            >
                                Buy
                            </button>
                            <button
                                type="button"
                                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${investmentType === 'sell' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                                onClick={() => setInvestmentType('sell')}
                            >
                                Sell
                            </button>
                        </div>
                    )}

                    {/* Recipient Selection for Lend/Borrow */}
                    {isLendBorrow && (
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                                {type === 'lend' ? 'Lend To' : 'Borrow From'}
                            </label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-205 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 text-gray-900 dark:text-white outline-none transition-all"
                                placeholder="Type person's name..."
                                value={recipientInput}
                                onChange={(e) => {
                                    setRecipientInput(e.target.value);
                                    setSelectedRecipient(null);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                required
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                    {suggestions.map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleRecipientSelect(suggestion)}
                                            className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                                        >
                                            <span className="text-sm text-gray-800 dark:text-gray-200">{suggestion.name}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${suggestion.type === 'user' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>
                                                {suggestion.type === 'user' ? 'User' : 'Contact'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {recipientInput && !selectedRecipient && (
                                <div className="mt-1.5">
                                    {user && user.name.toLowerCase() === recipientInput.trim().toLowerCase() ? (
                                        <p className="text-xs text-rose-500 dark:text-rose-400 italic">
                                            You cannot {type} with yourself.
                                        </p>
                                    ) : !users.some(u => u.name.toLowerCase() === recipientInput.trim().toLowerCase()) &&
                                        !dummyUsers.some(d => d.name.toLowerCase() === recipientInput.trim().toLowerCase()) ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                            Will be saved as a new contact
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold">₹</span>
                            <input
                                type="number"
                                className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-205 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition-all font-bold text-lg text-gray-800 dark:text-white"
                                required
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Category (not for lend/borrow) */}
                    {!isLendBorrow && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Category</label>
                            {!isAddingCategory ? (
                                <div className="flex gap-2">
                                    <CategoryDropdown
                                        categories={filteredCategories}
                                        value={category}
                                        onChange={setCategory}
                                        type={type}
                                        recents={recentCategories}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingCategory(true)}
                                        className="px-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors font-bold text-xl flex-shrink-0 cursor-pointer"
                                    >
                                        +
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-205 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none text-gray-900 dark:text-white transition-all"
                                        placeholder="New Category Name"
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddCategory}
                                        className="px-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
                                    >
                                        <Check size={20} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingCategory(false)}
                                        className="px-4 bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-705 transition-colors cursor-pointer"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {!isLendBorrow && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Payment Method</label>
                            <select
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none text-gray-900 dark:text-white transition-all select-none"
                                value={paymentMethodId}
                                onChange={(e) => setPaymentMethodId(e.target.value)}
                            >
                                {paymentMethods.map(pm => (
                                    <option key={pm._id} value={pm._id} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">{pm.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Date & Time</label>
                        <input
                            type="datetime-local"
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none text-gray-900 dark:text-white transition-all"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Description</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-255 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none text-gray-900 dark:text-white transition-all"
                            placeholder="What was this for?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 dark:shadow-none mt-2 cursor-pointer"
                    >
                        Save Transaction
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddTransactionModal;
