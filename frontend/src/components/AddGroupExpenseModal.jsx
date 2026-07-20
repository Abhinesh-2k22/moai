import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { getMemberId, getMemberLabel } from '../utils/groupMembers';
import CategoryDropdown from './CategoryDropdown';
import { X, DollarSign, Users, FileText, Calendar } from 'lucide-react';

const AddGroupExpenseModal = ({ isOpen, onClose, group, onExpenseAdded, expenseToEdit }) => {
    const { user } = useContext(AuthContext);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [payerId, setPayerId] = useState('');
    const [date, setDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    const [loading, setLoading] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [category, setCategory] = useState('');
    const [paymentMethodId, setPaymentMethodId] = useState('');
    const [categories, setCategories] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [splitMode, setSplitMode] = useState('equally');
    const [splitValues, setSplitValues] = useState({});

    const isEditing = !!expenseToEdit;

    useEffect(() => {
        if (isOpen && group) {
            fetchCategoriesAndPaymentMethods();
            if (isEditing) {
                // Edit Mode: Pre-fill data
                setDescription(expenseToEdit.description);
                setAmount(expenseToEdit.amount);
                setDate(new Date(new Date(expenseToEdit.date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));

                // Set Payer
                if (expenseToEdit.payerId) {
                    setPayerId(expenseToEdit.payerId._id);
                } else if (expenseToEdit.payerGuestName) {
                    setPayerId(`guest:${expenseToEdit.payerGuestName}`);
                }

                // Set Split Members
                const splitIds = expenseToEdit.splits.map(s => s.userId ? s.userId._id : `guest:${s.guestName}`);
                setSelectedMemberIds(splitIds);
                setSplitMode('exact');
                const initialValues = {};
                expenseToEdit.splits.forEach(s => {
                    const id = s.userId ? s.userId._id : `guest:${s.guestName}`;
                    initialValues[id] = s.amount;
                });
                setSplitValues(initialValues);
            } else {
                // Add Mode: Reset and Default
                resetForm();

                // Default select all
                const allIds = group.members.map(m => getMemberId(m));
                setSelectedMemberIds(allIds);
                setSplitMode('equally');
                setSplitValues({});

                // Default pay
                if (group.members.length > 0) {
                    const firstMember = group.members[0];
                    setPayerId(getMemberId(firstMember));
                }
            }
        }
    }, [isOpen, group, expenseToEdit]);

    const fetchCategoriesAndPaymentMethods = async () => {
        try {
            const [catRes, pmRes] = await Promise.all([
                api.get('/categories'),
                api.get('/payment-methods/ensure-defaults')
            ]);
            setCategories(catRes.data.filter(c => c.type === 'expense'));
            setPaymentMethods(pmRes.data);
            const unspecified = pmRes.data.find(m => m.name === 'Unspecified');
            if (unspecified) setPaymentMethodId(unspecified._id);
        } catch (err) {
            console.error(err);
        }
    };

    const isPayerMe = () => {
        if (!payerId || !user) return false;
        if (payerId === user.id) return true;
        if (payerId.startsWith('guest:')) {
            const guestName = payerId.split(':')[1];
            const myMember = group.members.find(m =>
                m.userId && m.userId._id === user.id && m.guestName === guestName
            );
            return !!myMember;
        }
        return false;
    };

    const isMeInvolved = () => {
        if (!user) return false;
        if (isPayerMe()) return true;
        return selectedMemberIds.some(id => {
            if (id === user.id) return true;
            if (id.startsWith('guest:')) {
                const guestName = id.split(':')[1];
                const myMember = group.members.find(m =>
                    m.userId && m.userId._id === user.id && m.guestName === guestName
                );
                return !!myMember;
            }
            return false;
        });
    };

    const handleToggleMember = (id) => {
        if (selectedMemberIds.includes(id)) {
            setSelectedMemberIds(selectedMemberIds.filter(mId => mId !== id));
        } else {
            setSelectedMemberIds([...selectedMemberIds, id]);
        }
    };

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setDate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    };

    if (!isOpen || !group) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (selectedMemberIds.length === 0) {
            alert('Please select at least one person to split with.');
            return;
        }

        setLoading(true);
        try {
            const totalAmount = parseFloat(amount);
            if (isNaN(totalAmount) || totalAmount <= 0) {
                alert('Please enter a valid amount.');
                setLoading(false);
                return;
            }

            let finalSplits = [];

            if (splitMode === 'equally') {
                const splitCount = selectedMemberIds.length;
                const splitAmount = parseFloat((totalAmount / splitCount).toFixed(2));

                finalSplits = selectedMemberIds.map((memberId, index) => {
                    const isGuest = memberId.startsWith('guest:');
                    const id = isGuest ? null : memberId;
                    const guestName = isGuest ? memberId.split(':')[1] : null;

                    let splitAmountForMember = splitAmount;
                    if (index === selectedMemberIds.length - 1) {
                        const assigned = splitAmount * (splitCount - 1);
                        splitAmountForMember = parseFloat((totalAmount - assigned).toFixed(2));
                    }

                    return {
                        userId: id,
                        guestName: guestName,
                        amount: splitAmountForMember
                    };
                });
            } else if (splitMode === 'percentage') {
                let totalPercent = 0;
                selectedMemberIds.forEach(id => {
                    totalPercent += parseFloat(splitValues[id] || 0);
                });
                if (Math.abs(totalPercent - 100) > 0.01) {
                    alert('Total percentage must equal 100%');
                    setLoading(false);
                    return;
                }

                let assignedAmount = 0;
                finalSplits = selectedMemberIds.map((memberId, index) => {
                    const isGuest = memberId.startsWith('guest:');
                    const id = isGuest ? null : memberId;
                    const guestName = isGuest ? memberId.split(':')[1] : null;

                    const pct = parseFloat(splitValues[memberId] || 0);
                    let splitAmountForMember = parseFloat(((totalAmount * pct) / 100).toFixed(2));

                    if (index === selectedMemberIds.length - 1) {
                        splitAmountForMember = parseFloat((totalAmount - assignedAmount).toFixed(2));
                    } else {
                        assignedAmount += splitAmountForMember;
                    }

                    return { userId: id, guestName, amount: splitAmountForMember };
                });
            } else if (splitMode === 'exact') {
                let totalExact = 0;
                selectedMemberIds.forEach(id => {
                    totalExact += parseFloat(splitValues[id] || 0);
                });
                if (Math.abs(totalExact - totalAmount) > 0.01) {
                    alert(`Total split amounts (${totalExact}) must equal the total expense amount (${totalAmount})`);
                    setLoading(false);
                    return;
                }

                finalSplits = selectedMemberIds.map((memberId) => {
                    const isGuest = memberId.startsWith('guest:');
                    const id = isGuest ? null : memberId;
                    const guestName = isGuest ? memberId.split(':')[1] : null;

                    return { userId: id, guestName, amount: parseFloat(splitValues[memberId] || 0) };
                });
            }

            const payload = {
                description,
                amount: totalAmount,
                date,
                splits: finalSplits
            };

            // Payer Logic
            if (payerId.startsWith('guest:')) {
                payload.payerGuestName = payerId.split(':')[1];
            } else {
                payload.payerId = payerId;
            }

            if (isEditing) {
                await api.put(`/groups/${group._id}/expenses/${expenseToEdit._id}`, payload);
            } else {
                if (isMeInvolved() && (category || paymentMethodId)) {
                    const pm = paymentMethods.find(m => m._id === paymentMethodId);
                    payload.userMeta = {
                        category: category || undefined,
                        paymentMethodId: paymentMethodId || undefined,
                        paymentMethodName: pm?.name || 'Unspecified'
                    };
                }
                await api.post(`/groups/${group._id}/expenses`, payload);
            }

            onExpenseAdded();
            onClose();
            resetForm();
        } catch (err) {
            console.error(err);
            alert(`Failed to ${isEditing ? 'update' : 'add'} expense`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100 max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-slate-800/80">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{isEditing ? 'Edit Expense' : 'Add Group Expense'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500 dark:text-gray-455 cursor-pointer">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Description</label>
                        <div className="relative">
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                            <input
                                type="text"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 text-gray-900 dark:text-white outline-none transition-all"
                                placeholder="Dinner, Taxi, etc."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Total Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold">₹</span>
                            <input
                                type="number"
                                required
                                min="0.01"
                                step="0.01"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition-all font-bold text-lg text-gray-800 dark:text-white"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Paid By */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Paid By</label>
                        <div className="relative">
                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                            <select
                                required
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition-all appearance-none text-gray-900 dark:text-white"
                                value={payerId}
                                onChange={(e) => setPayerId(e.target.value)}
                            >
                                <option value="" disabled className="bg-white dark:bg-slate-900 text-gray-400 dark:text-gray-500">Select Payer</option>
                                {group.members.map((member, idx) => {
                                    const value = getMemberId(member);
                                    const label = getMemberLabel(member, user?.id);
                                    return (
                                        <option key={idx} value={value} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Split With */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Split With</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedMemberIds(group.members.map(m => getMemberId(m)))}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMemberIds([])}
                                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-3">
                            {['equally', 'percentage', 'exact'].map(mode => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setSplitMode(mode)}
                                    className={`flex-1 py-1.5 text-xs font-bold capitalize rounded-lg transition-all cursor-pointer ${splitMode === mode ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                        <div className="bg-gray-50 dark:bg-slate-950 rounded-xl p-3 border border-gray-200 dark:border-slate-800 space-y-2 max-h-40 overflow-y-auto">
                            {group.members.map((member, idx) => {
                                const id = getMemberId(member);
                                const name = getMemberLabel(member, user?.id);
                                const isSelected = selectedMemberIds.includes(id);
                                return (
                                    <div key={idx}
                                        className={`flex flex-col gap-2 p-2 rounded-lg transition-colors border ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50' : 'hover:bg-gray-100 dark:hover:bg-slate-900 border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleToggleMember(id)}>
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                                                {isSelected && <Users size={12} className="text-white" />}
                                            </div>
                                            <span className={`text-sm font-medium flex-1 ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'}`}>{name}</span>
                                        </div>
                                        
                                        {isSelected && splitMode !== 'equally' && (
                                            <div className="pl-8 pr-2 pb-1 animate-fade-in">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">
                                                        {splitMode === 'percentage' ? '%' : '₹'}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-sm text-gray-800 dark:text-gray-200"
                                                        placeholder="0.00"
                                                        value={splitValues[id] || ''}
                                                        onChange={(e) => setSplitValues({...splitValues, [id]: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {!isEditing && isMeInvolved() && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Your Category (private)</label>
                            <CategoryDropdown
                                categories={categories}
                                value={category}
                                onChange={setCategory}
                                type="expense"
                                allowFavoriteToggle={false}
                            />
                        </div>
                    )}
                    
                    {!isEditing && isPayerMe() && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Payment Method (private)</label>
                            <select
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
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
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                            <input
                                type="datetime-local"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition-all text-gray-900 dark:text-white"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 dark:shadow-none mt-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {loading ? 'Processing...' : (isEditing ? 'Update Expense' : 'Split Expense')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddGroupExpenseModal;
