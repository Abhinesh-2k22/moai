import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import AddGroupExpenseModal from '../components/AddGroupExpenseModal';
import TagGroupExpenseModal from '../components/TagGroupExpenseModal';
import ConfirmSettlementModal from '../components/ConfirmSettlementModal';
import { getMemberLabel, getMemberInitial } from '../utils/groupMembers';
import { Plus, UserPlus, Clock, ArrowUpRight, ArrowDownLeft, Wallet, X, Pencil, Trash2, Lock, Unlock, Tag } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import Avatar from '../components/Avatar';

const GroupDetail = () => {
    const { id } = useParams();
    const { user } = useContext(AuthContext);
    const [group, setGroup] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [balances, setBalances] = useState([]);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [expenseMeta, setExpenseMeta] = useState({});
    const [taggingExpense, setTaggingExpense] = useState(null);
    const [activeSplitPopup, setActiveSplitPopup] = useState(null);

    // Member Addition State
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [selectedContactId, setSelectedContactId] = useState('');
    const [contacts, setContacts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // Settlement Modal State
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [settleData, setSettleData] = useState(null);
    const [settlePaymentMethodId, setSettlePaymentMethodId] = useState('');
    const [paymentMethods, setPaymentMethods] = useState([]);

    // Date and Sort Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterPaidBy, setFilterPaidBy] = useState('');
    const [filterSplitWith, setFilterSplitWith] = useState('');

    const filteredExpenses = expenses.filter(exp => {
        let matchPaidBy = true;
        let matchSplitWith = true;

        if (filterPaidBy) {
            const payerKey = exp.payerId ? exp.payerId._id : `guest:${exp.payerGuestName}`;
            if (payerKey !== filterPaidBy) {
                matchPaidBy = false;
            }
        }

        if (filterSplitWith) {
            const splitKeys = exp.splits.map(s => s.userId ? s.userId._id : `guest:${s.guestName}`);
            if (!splitKeys.includes(filterSplitWith)) {
                matchSplitWith = false;
            }
        }

        return matchPaidBy && matchSplitWith;
    });

    useEffect(() => {
        fetchGroupData();
    }, [id, startDate, endDate]);

    useEffect(() => {
        if (isAddingMember) {
            fetchAllUsers();
            fetchContacts();
        }
    }, [isAddingMember]);

    const fetchPaymentMethods = async () => {
        try {
            const res = await api.get('/payment-methods/ensure-defaults');
            setPaymentMethods(res.data);
            const unspecified = res.data.find(m => m.name === 'Unspecified');
            if (unspecified) setSettlePaymentMethodId(unspecified._id);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchPaymentMethods();
    }, []);

    const fetchContacts = async () => {
        try {
            const res = await api.get('/users/dummy');
            setContacts(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await api.get('/users');
            setAllUsers(res.data);
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    };

    const fetchGroupData = async () => {
        try {
            const [groupRes, expenseRes, balanceRes, metaRes] = await Promise.all([
                api.get(`/groups/${id}`),
                api.get(`/groups/${id}/expenses`, { params: { startDate, endDate } }),
                api.get(`/groups/${id}/expenses/balances`),
                api.get(`/groups/${id}/expenses/meta`)
            ]);
            setGroup(groupRes.data);
            setExpenses(expenseRes.data);
            setBalances(balanceRes.data);
            const metaMap = {};
            metaRes.data.forEach(m => {
                metaMap[m.groupExpenseId] = m;
            });
            setExpenseMeta(metaMap);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        try {
            const payload = {};
            if (selectedContactId) {
                payload.dummyUserId = selectedContactId;
            } else if (newMemberEmail) {
                payload.email = newMemberEmail;
            }
            await api.post(`/groups/${id}/members`, payload);
            setNewMemberEmail('');
            setSelectedContactId('');
            setIsAddingMember(false);
            fetchGroupData();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error adding member');
        }
    };

    const handleToggleFreeze = async () => {
        const newStatus = group.status === 'closed' ? 'open' : 'closed';
        const action = newStatus === 'closed' ? 'freeze' : 'resume';
        if (!window.confirm(`Are you sure you want to ${action} this group?`)) return;
        try {
            await api.patch(`/groups/${id}/status`, { status: newStatus });
            fetchGroupData();
        } catch (err) {
            alert(err.response?.data?.msg || `Failed to ${action} group`);
        }
    };

    const initiateSettleUp = (otherUserId, otherGuestName, amount, theyPaidMe = false) => {
        setSettleData({ otherUserId, otherGuestName, amount, theyPaidMe });
        setIsSettleModalOpen(true);
    };

    const executeSettleUp = async () => {
        if (!settleData) return;
        const { otherUserId, otherGuestName, amount, theyPaidMe } = settleData;

        try {
            if (theyPaidMe) {
                await api.post('/settlements', {
                    groupId: id,
                    fromUserId: otherUserId || undefined,
                    fromGuestName: otherGuestName || undefined,
                    amount,
                    paymentMethodId: settlePaymentMethodId || undefined
                });
            } else {
                await api.post('/settlements', {
                    groupId: id,
                    toUserId: otherUserId || undefined,
                    toGuestName: otherGuestName || undefined,
                    amount,
                    paymentMethodId: settlePaymentMethodId || undefined
                });
            }
            fetchGroupData();
            setIsSettleModalOpen(false);
            setSettleData(null);
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to record settlement');
        }
    };

    const handleEditExpense = (expense) => {
        setEditingExpense(expense);
        setIsExpenseModalOpen(true);
    };

    const handleDeleteExpense = async (expenseId) => {
        if (!window.confirm('Are you sure you want to delete this expense?')) return;
        try {
            await api.delete(`/groups/${id}/expenses/${expenseId}`);
            fetchGroupData();
        } catch (err) {
            console.error(err);
            alert('Failed to delete expense');
        }
    };

    const handleCloseModal = () => {
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
    };

    if (!group) return <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div></div>;

    const isOwner = group.createdBy === user.id || group.createdBy?._id === user.id;
    const isFrozen = group.status === 'closed';

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="glass-card p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Wallet size={120} className="text-indigo-600 dark:text-indigo-400" />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{group.name}</h1>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${isFrozen ? 'bg-amber-100/30 text-amber-700 dark:text-amber-400' : 'bg-indigo-100/30 text-indigo-700 dark:text-indigo-400'}`}>
                                {isFrozen ? 'Frozen' : 'Active'}
                            </span>
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span className="flex -space-x-2">
                                {group.members.slice(0, 3).map((m, i) => {
                                    if (m.userId) {
                                        return (
                                            <Avatar
                                                key={i}
                                                user={m.userId}
                                                size="w-8 h-8"
                                                className="border-2 border-white dark:border-slate-800 cursor-help"
                                                title={getMemberLabel(m, user.id)}
                                            />
                                        );
                                    } else {
                                        return (
                                            <div
                                                key={i}
                                                className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border-2 border-white dark:border-slate-800 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-help"
                                                title={getMemberLabel(m, user.id)}
                                            >
                                                {getMemberInitial(m)}
                                            </div>
                                        );
                                    }
                                })}
                                {group.members.length > 3 && (
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-white dark:border-slate-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                                        +{group.members.length - 3}
                                    </div>
                                )}
                            </span>
                            <span className="ml-2">{group.members.length} Members</span>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto flex-wrap">
                        {isOwner && (
                            <button
                                onClick={handleToggleFreeze}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-850 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-all font-medium shadow-sm cursor-pointer"
                            >
                                {isFrozen ? <Unlock size={18} /> : <Lock size={18} />}
                                {isFrozen ? 'Resume' : 'Freeze'}
                            </button>
                        )}
                        {isOwner && !isFrozen && (
                            <button
                                onClick={() => {
                                    if (expenses.length > 0) {
                                        const isSettled = balances.every(b => Math.abs(b.amount) <= 0.01);
                                        if (!isSettled) {
                                            alert('Cannot add members because the group has unsettled balances. Please settle all debts first.');
                                            return;
                                        }
                                    }
                                    setIsAddingMember(!isAddingMember);
                                }}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 border px-5 py-2.5 rounded-xl transition-all font-medium shadow-sm cursor-pointer ${
                                    expenses.length > 0 && !balances.every(b => Math.abs(b.amount) <= 0.01)
                                    ? 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-gray-500 opacity-70 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-850 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/80'
                                }`}
                                title={expenses.length > 0 && !balances.every(b => Math.abs(b.amount) <= 0.01) ? "Please settle all debts before adding members" : ""}
                            >
                                <UserPlus size={18} />
                                Add Member
                            </button>
                        )}
                        {!isFrozen && (
                        <button
                            onClick={() => { setEditingExpense(null); setIsExpenseModalOpen(true); }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all font-medium shadow-lg hover:shadow-indigo-500/30 cursor-pointer"
                        >
                            <Plus size={18} />
                            Add Expense
                        </button>
                        )}
                    </div>
                </div>

                {isAddingMember && (
                    <div className="mt-6 bg-gray-50/80 dark:bg-slate-900/50 p-6 rounded-xl border border-gray-200 dark:border-slate-800/80 animate-slide-up backdrop-blur-sm">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-4">Add New Member</h3>
                        <form onSubmit={handleAddMember} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Search User (Name/Email)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-850 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            placeholder="Type to search..."
                                            value={newMemberEmail}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNewMemberEmail(val);

                                                if (val.length > 0) {
                                                    const lowerVal = val.toLowerCase();
                                                    const filtered = allUsers.filter(u =>
                                                        (u.name.toLowerCase().includes(lowerVal) || u.email.toLowerCase().includes(lowerVal)) &&
                                                        !group.members.some(m => m.userId && m.userId._id === u._id) // Exclude existing members
                                                    );
                                                    setSearchResults(filtered);
                                                    setShowDropdown(true);
                                                } else {
                                                    setSearchResults([]);
                                                    setShowDropdown(false);
                                                }
                                            }}
                                            onFocus={() => {
                                                if (newMemberEmail && searchResults.length > 0) setShowDropdown(true);
                                            }}
                                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                        />

                                        {/* Search Results Dropdown */}
                                        {showDropdown && searchResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 animate-fade-in">
                                                {searchResults.map(user => (
                                                    <div
                                                        key={user._id}
                                                        className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-850 cursor-pointer transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0"
                                                        onMouseDown={() => {
                                                            setNewMemberEmail(user.email);
                                                            setShowDropdown(false);
                                                        }}
                                                    >
                                                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{user.name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username || 'no-username'} • {user.email}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 -left-3 md:flex items-center hidden">
                                        <span className="bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-xs font-bold px-2 py-1 rounded">OR</span>
                                    </div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Add Contact</label>
                                    <select
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-850 text-gray-800 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={selectedContactId}
                                        onChange={(e) => {
                                            setSelectedContactId(e.target.value);
                                            setNewMemberEmail('');
                                        }}
                                        disabled={!!newMemberEmail}
                                    >
                                        <option value="">Select from your contacts...</option>
                                        {contacts
                                            .filter(c => !group.members.some(m => m.dummyUserId && (m.dummyUserId._id || m.dummyUserId) === c._id))
                                            .map(c => (
                                                <option key={c._id} value={c._id}>{c.name}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsAddingMember(false)} className="px-5 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md transition-all cursor-pointer">Add Member</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Balances Section */}
                <div className="lg:col-span-1 space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        Balances <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{balances.length}</span>
                    </h2>
                    <div className="space-y-3">
                        {balances.map((b) => {
                            let name = 'Unknown';
                            let isMe = false;
                            let toUserId = null;
                            let toGuestName = null;

                            if (b.key.startsWith('guest:')) {
                                const guestKey = b.key.split(':')[1];
                                const member = group.members.find(m =>
                                    m.guestName && m.guestName.toLowerCase() === guestKey
                                );
                                name = member ? getMemberLabel(member, user.id) : guestKey;
                                toGuestName = member?.guestName || guestKey;
                            } else {
                                const member = group.members.find(m => m.userId && m.userId._id === b.key);
                                name = member ? member.userId.name : 'Unknown';
                                toUserId = b.key;
                                if (b.key === user.id) isMe = true;
                            }

                            const relative = b.relativeToMe || 0;
                            const canSettle = !isMe && Math.abs(relative) > 0.01;

                            return (
                                <div key={b.key} className="glass-card p-4 rounded-xl flex justify-between items-center group hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${b.amount >= 0 ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450'
                                            }`}>
                                            {name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-white">{isMe ? 'You' : name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{isMe ? 'Personal Balance' : 'Group Member'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <p className={`font-bold ${b.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {b.amount >= 0 ? '+' : '-'}₹{Math.abs(b.amount).toFixed(2)}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">{b.amount >= 0 ? 'gets back' : 'owes'}</p>
                                        {canSettle && (
                                            <button
                                                onClick={() => initiateSettleUp(toUserId, toGuestName, Math.abs(relative), relative > 0)}
                                                className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium cursor-pointer"
                                            >
                                                {relative < 0 ? `Pay ₹${Math.abs(relative).toFixed(2)}` : `Record ₹${relative.toFixed(2)} received`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {balances.length === 0 && (
                            <div className="text-center py-8 text-gray-400 dark:text-gray-500 bg-gray-50/20 dark:bg-slate-900/20 rounded-xl border border-dashed border-gray-200 dark:border-slate-800/80">
                                No balances yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Expenses List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            Expense History
                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{expenses.length}</span>
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full ml-2">
                                Total: ₹{filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                            </span>
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex bg-gray-100 dark:bg-slate-900 rounded-lg p-1 gap-1">
                                <button
                                    onClick={() => {
                                        const prev = subMonths(new Date(), 1);
                                        setStartDate(format(startOfMonth(prev), 'yyyy-MM-dd'));
                                        setEndDate(format(endOfMonth(prev), 'yyyy-MM-dd'));
                                    }}
                                    className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-md transition-all cursor-pointer"
                                >
                                    Previous Month
                                </button>
                                <button
                                    onClick={() => {
                                        const now = new Date();
                                        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
                                        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
                                    }}
                                    className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-md transition-all cursor-pointer"
                                >
                                    Ongoing Month
                                </button>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm">
                                <input
                                    type="date"
                                    className="text-xs border-none focus:ring-0 text-gray-600 dark:text-gray-300 bg-transparent"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    title="Start Date"
                                />
                                <span className="text-gray-400 dark:text-gray-600">-</span>
                                <input
                                    type="date"
                                    className="text-xs border-none focus:ring-0 text-gray-600 dark:text-gray-300 bg-transparent"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    title="End Date"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <select 
                                    className="text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                    value={filterPaidBy}
                                    onChange={(e) => setFilterPaidBy(e.target.value)}
                                >
                                    <option value="">Paid By: All</option>
                                    {group?.members.map((m, idx) => {
                                        const val = m.userId ? m.userId._id : `guest:${m.guestName}`;
                                        return <option key={`p-${idx}`} value={val}>{getMemberLabel(m, user.id)}</option>;
                                    })}
                                </select>
                                <select 
                                    className="text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                    value={filterSplitWith}
                                    onChange={(e) => setFilterSplitWith(e.target.value)}
                                >
                                    <option value="">Split With: All</option>
                                    {group?.members.map((m, idx) => {
                                        const val = m.userId ? m.userId._id : `guest:${m.guestName}`;
                                        return <option key={`s-${idx}`} value={val}>{getMemberLabel(m, user.id)}</option>;
                                    })}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {filteredExpenses.map((exp) => (
                            <div key={exp._id} className="glass-card p-5 rounded-xl hover:shadow-md transition-all group border border-gray-100 dark:border-slate-850 relative">
                                <div className="absolute top-4 right-4 flex gap-2">
                                    {!isFrozen && (
                                    <>
                                    <button
                                        onClick={() => handleEditExpense(exp)}
                                        className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/80 transition-colors cursor-pointer"
                                        title="Edit Expense"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteExpense(exp._id)}
                                        className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/80 transition-colors cursor-pointer"
                                        title="Delete Expense"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    </>
                                    )}
                                </div>
                                <div className="flex items-center justify-between pr-20">
                                    <div className="flex items-center gap-4">
                                        {exp.payerId ? (
                                            <Avatar
                                                user={exp.payerId}
                                                size="w-12 h-12"
                                                className="shadow-sm flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white border border-gray-200 dark:border-slate-800/80 flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                                                {exp.payerGuestName?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-gray-800 dark:text-white text-lg break-words">{exp.description}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 flex-wrap mb-1">
                                                <span className="font-medium text-indigo-600 dark:text-indigo-400">{exp.payerId ? exp.payerId.name : exp.payerGuestName}</span> paid
                                                <span className="font-bold text-gray-700 dark:text-gray-200 ml-1">₹{exp.amount.toFixed(2)}</span>
                                                {expenseMeta[exp._id]?.category && (
                                                    <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full ml-1">
                                                        {expenseMeta[exp._id].category}
                                                    </span>
                                                )}
                                                {expenseMeta[exp._id]?.paymentMethodName && expenseMeta[exp._id].paymentMethodName !== 'Unspecified' && (
                                                    <span className="text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                                                        {expenseMeta[exp._id].paymentMethodName}
                                                    </span>
                                                )}
                                            </p>
                                            
                                            {/* Shared splits avatars */}
                                            <div className="flex items-center gap-1.5 mt-2 flex-wrap relative">
                                                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Split with:</span>
                                                <div 
                                                    className="flex -space-x-1.5 overflow-hidden cursor-pointer p-0.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800/40 transition-colors relative"
                                                    onMouseEnter={() => setActiveSplitPopup(exp._id)}
                                                    onMouseLeave={() => setActiveSplitPopup(null)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveSplitPopup(prev => prev === exp._id ? null : exp._id);
                                                    }}
                                                >
                                                    {exp.splits.map((split, sIdx) => {
                                                        const key = split.userId?._id || split.guestName || sIdx;
                                                        if (split.userId) {
                                                            return (
                                                                <Avatar
                                                                    key={key}
                                                                    user={split.userId}
                                                                    size="w-5 h-5"
                                                                    className="border border-white dark:border-slate-800 shadow-sm"
                                                                    title={split.userId.name}
                                                                />
                                                            );
                                                        } else {
                                                            return (
                                                                <div
                                                                    key={key}
                                                                    className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold border border-white dark:border-slate-800 shadow-sm"
                                                                    title={`${split.guestName} (Guest)`}
                                                                >
                                                                    {split.guestName?.charAt(0).toUpperCase() || '?'}
                                                                </div>
                                                            );
                                                        }
                                                    })}
                                                </div>

                                                {/* Tooltip Popup */}
                                                {activeSplitPopup === null && false}

                                                {activeSplitPopup === exp._id && (
                                                    <div 
                                                        className="absolute left-0 bottom-full mb-2 w-56 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-xl z-30 animate-fade-in text-left cursor-default"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Split Details</div>
                                                        
                                                        {/* Paid By info */}
                                                        <div className="flex flex-col gap-0.5 mb-3 pb-2 border-b border-gray-100 dark:border-slate-850">
                                                            <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Paid By</span>
                                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">
                                                                {exp.payerId ? exp.payerId.name : exp.payerGuestName} (₹{exp.amount.toFixed(2)})
                                                            </span>
                                                        </div>

                                                        {/* Splits List */}
                                                        <div className="space-y-1.5">
                                                            <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Split Breakdown</span>
                                                            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                                                {exp.splits.map((split, sIdx) => (
                                                                    <div key={sIdx} className="flex justify-between items-center text-xs">
                                                                        <span className="text-gray-600 dark:text-gray-300 truncate max-w-[110px]">
                                                                            {split.userId ? split.userId.name : `${split.guestName} (Guest)`}
                                                                        </span>
                                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                                                                            ₹{split.amount.toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {(() => {
                                                const mySplit = exp.splits.find(s => s.userId && s.userId._id === user.id);
                                                const isPayer = exp.payerId && exp.payerId._id === user.id;
                                                if (mySplit || isPayer) {
                                                    return (
                                                        <button
                                                            onClick={() => setTaggingExpense(exp)}
                                                            className="mt-2 text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium cursor-pointer"
                                                        >
                                                            <Tag size={12} />
                                                            {expenseMeta[exp._id] ? 'Edit my tags' : 'Tag for my ledger'}
                                                        </button>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-1">{format(new Date(exp.date), 'MMM dd')}</p>
                                        {(() => {
                                            const mySplit = exp.splits.find(s => s.userId && s.userId._id === user.id);
                                            const isPayer = exp.payerId && exp.payerId._id === user.id;

                                            if (isPayer) {
                                                const myShare = mySplit ? mySplit.amount : 0;
                                                const lentAmount = exp.amount - myShare;
                                                if (lentAmount > 0.01) {
                                                    return (
                                                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg">
                                                            <ArrowUpRight size={14} />
                                                            <span className="text-xs font-bold">You lent ₹{lentAmount.toFixed(2)}</span>
                                                        </div>
                                                    );
                                                }
                                            } else if (mySplit) {
                                                return (
                                                    <div className="flex items-center gap-1 text-rose-500 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded-lg">
                                                        <ArrowDownLeft size={14} />
                                                        <span className="text-xs font-bold">You owe ₹{mySplit.amount.toFixed(2)}</span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredExpenses.length === 0 && expenses.length > 0 && (
                            <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50/20 dark:bg-slate-900/20 rounded-xl border border-dashed border-gray-200 dark:border-slate-800/80">
                                No expenses match your filters.
                            </div>
                        )}
                        {expenses.length === 0 && (
                            <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50/20 dark:bg-slate-900/20 rounded-xl border border-dashed border-gray-200 dark:border-slate-800/80">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="p-3 bg-white dark:bg-slate-900 rounded-full shadow-sm">
                                        <Wallet size={24} className="text-gray-300 dark:text-gray-600" />
                                    </div>
                                    <p>No expenses recorded yet.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AddGroupExpenseModal
                isOpen={isExpenseModalOpen}
                onClose={handleCloseModal}
                group={group}
                onExpenseAdded={fetchGroupData}
                expenseToEdit={editingExpense}
            />

            <TagGroupExpenseModal
                isOpen={!!taggingExpense}
                onClose={() => setTaggingExpense(null)}
                expense={taggingExpense}
                groupId={id}
                existingMeta={taggingExpense ? expenseMeta[taggingExpense._id] : null}
                onSaved={fetchGroupData}
            />

            <ConfirmSettlementModal
                isOpen={isSettleModalOpen && settleData !== null}
                onClose={() => setIsSettleModalOpen(false)}
                onConfirm={executeSettleUp}
                title="Settle Up"
                message={`You are about to record a settlement of ₹${settleData?.amount.toFixed(2)} to ${settleData?.toName}.`}
                amount={settleData?.amount || 0}
                paymentMethods={paymentMethods}
                paymentMethodId={settlePaymentMethodId}
                setPaymentMethodId={setSettlePaymentMethodId}
                loading={false}
            />
        </div>
    );
};

export default GroupDetail;
