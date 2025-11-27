import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import AddGroupExpenseModal from '../components/AddGroupExpenseModal';
import { Plus, UserPlus, CheckCircle, Clock, ArrowUpRight, ArrowDownLeft, Wallet, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const GroupDetail = () => {
    const { id } = useParams();
    const { user } = useContext(AuthContext);
    const [group, setGroup] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [balances, setBalances] = useState([]);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    // Member Addition State
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newGuestName, setNewGuestName] = useState('');
    const [allUsers, setAllUsers] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // Date Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchGroupData();
    }, [id, startDate, endDate]);

    useEffect(() => {
        if (isAddingMember) {
            fetchAllUsers();
        }
    }, [isAddingMember]);

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
            const [groupRes, expenseRes, balanceRes] = await Promise.all([
                api.get(`/groups/${id}`),
                api.get(`/groups/${id}/expenses`, { params: { startDate, endDate } }),
                api.get(`/groups/${id}/expenses/balances`)
            ]);
            setGroup(groupRes.data);
            setExpenses(expenseRes.data);
            setBalances(balanceRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/groups/${id}/members`, {
                email: newMemberEmail,
                guestName: newGuestName
            });
            setNewMemberEmail('');
            setNewGuestName('');
            setIsAddingMember(false);
            fetchGroupData();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error adding member');
        }
    };

    const handleSettleUp = async (toUserId, toGuestName, amount) => {
        if (!window.confirm(`Confirm payment of ₹${Math.abs(amount).toFixed(2)}?`)) return;

        try {
            await api.post('/settlements', {
                groupId: id,
                toUserId,
                toGuestName,
                amount: Math.abs(amount)
            });
            fetchGroupData();
        } catch (err) {
            console.error(err);
        }
    };

    if (!group) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

    const isOwner = group.createdBy === user.id;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="glass-card p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Wallet size={120} className="text-indigo-600" />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-gray-800">{group.name}</h1>
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wide">
                                {group.status}
                            </span>
                        </div>
                        <div className="text-gray-500 flex items-center gap-2">
                            <span className="flex -space-x-2">
                                {group.members.slice(0, 3).map((m, i) => (
                                    <div
                                        key={i}
                                        className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-xs font-bold text-indigo-600 cursor-help"
                                        title={m.userId?.name || m.guestName || 'Unknown'}
                                    >
                                        {(m.userId?.name || m.guestName || '?').charAt(0)}
                                    </div>
                                ))}
                                {group.members.length > 3 && (
                                    <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-500">
                                        +{group.members.length - 3}
                                    </div>
                                )}
                            </span>
                            <span className="ml-2">{group.members.length} Members</span>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        {isOwner && expenses.length === 0 && (
                            <button
                                onClick={() => setIsAddingMember(!isAddingMember)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all font-medium shadow-sm"
                            >
                                <UserPlus size={18} />
                                Add Member
                            </button>
                        )}
                        <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-lg hover:shadow-indigo-500/30"
                        >
                            <Plus size={18} />
                            Add Expense
                        </button>
                    </div>
                </div>

                {isAddingMember && (
                    <div className="mt-6 bg-gray-50/80 p-6 rounded-xl border border-gray-200 animate-slide-up backdrop-blur-sm">
                        <h3 className="font-bold text-gray-800 mb-4">Add New Member</h3>
                        <form onSubmit={handleAddMember} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Search User (Name/Email)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            placeholder="Type to search..."
                                            value={newMemberEmail}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNewMemberEmail(val);
                                                setNewGuestName('');

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
                                            disabled={!!newGuestName}
                                        />

                                        {/* Search Results Dropdown */}
                                        {showDropdown && searchResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 animate-fade-in">
                                                {searchResults.map(user => (
                                                    <div
                                                        key={user._id}
                                                        className="px-4 py-3 hover:bg-indigo-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                                                        onClick={() => {
                                                            setNewMemberEmail(user.email);
                                                            setShowDropdown(false);
                                                        }}
                                                    >
                                                        <p className="font-bold text-gray-800 text-sm">{user.name}</p>
                                                        <p className="text-xs text-gray-500">@{user.username || 'no-username'} • {user.email}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 -left-3 md:flex items-center hidden">
                                        <span className="bg-gray-200 text-gray-500 text-xs font-bold px-2 py-1 rounded">OR</span>
                                    </div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Guest (Name)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        placeholder="John Doe"
                                        value={newGuestName}
                                        onChange={(e) => { setNewGuestName(e.target.value); setNewMemberEmail(''); }}
                                        disabled={!!newMemberEmail}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsAddingMember(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-md transition-all">Add Member</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Balances Section */}
                <div className="lg:col-span-1 space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        Balances <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{balances.length}</span>
                    </h2>
                    <div className="space-y-3">
                        {balances.map((b) => {
                            let name = 'Unknown';
                            let isMe = false;
                            if (b.key.startsWith('guest:')) {
                                name = b.key.split(':')[1];
                            } else {
                                const member = group.members.find(m => m.userId && m.userId._id === b.key);
                                name = member ? member.userId.name : 'Unknown';
                                if (b.key === user.id) isMe = true;
                            }

                            return (
                                <div key={b.key} className="glass-card p-4 rounded-xl flex justify-between items-center group hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${b.amount >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                            }`}>
                                            {name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">{isMe ? 'You' : name}</p>
                                            <p className="text-xs text-gray-500">{isMe ? 'Personal Balance' : 'Group Member'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${b.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {b.amount >= 0 ? '+' : '-'}₹{Math.abs(b.amount).toFixed(2)}
                                        </p>
                                        <p className="text-xs text-gray-400">{b.amount >= 0 ? 'gets back' : 'owes'}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {balances.length === 0 && (
                            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                No balances yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Expenses List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            Expense History
                            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{expenses.length}</span>
                            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ml-2">
                                Total: ₹{expenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                            </span>
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                                <button
                                    onClick={() => {
                                        const prev = subMonths(new Date(), 1);
                                        setStartDate(format(startOfMonth(prev), 'yyyy-MM-dd'));
                                        setEndDate(format(endOfMonth(prev), 'yyyy-MM-dd'));
                                    }}
                                    className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                >
                                    Previous Month
                                </button>
                                <button
                                    onClick={() => {
                                        const now = new Date();
                                        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
                                        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
                                    }}
                                    className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                >
                                    Ongoing Month
                                </button>
                            </div>
                            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                                <input
                                    type="date"
                                    className="text-xs border-none focus:ring-0 text-gray-600 bg-transparent"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    title="Start Date"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    className="text-xs border-none focus:ring-0 text-gray-600 bg-transparent"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    title="End Date"
                                />

                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {expenses.map((exp) => (
                            <div key={exp._id} className="glass-card p-5 rounded-xl hover:shadow-md transition-all group border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                            <Clock size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-gray-800 text-lg break-words">{exp.description}</p>
                                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                                <span className="font-medium text-indigo-600">{exp.payerId ? exp.payerId.name : exp.payerGuestName}</span> paid
                                                <span className="font-bold text-gray-700 ml-1">₹{exp.amount.toFixed(2)}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-gray-400 mb-1">{format(new Date(exp.date), 'MMM dd')}</p>
                                        {(() => {
                                            const mySplit = exp.splits.find(s => s.userId && s.userId._id === user.id);
                                            const isPayer = exp.payerId && exp.payerId._id === user.id;

                                            if (isPayer) {
                                                // I paid. I lent the total amount minus my share.
                                                // Or simply "You paid". The "You owe" logic was confusing.
                                                // Let's show "You paid" prominently in the main text (already there).
                                                // Here we can show "You lent ₹X" (Total - My Share)
                                                const myShare = mySplit ? mySplit.amount : 0;
                                                const lentAmount = exp.amount - myShare;
                                                if (lentAmount > 0.01) {
                                                    return (
                                                        <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                            <ArrowUpRight size={14} />
                                                            <span className="text-xs font-bold">You lent ₹{lentAmount.toFixed(2)}</span>
                                                        </div>
                                                    );
                                                }
                                            } else if (mySplit) {
                                                // I didn't pay, but I am in splits. I owe.
                                                return (
                                                    <div className="flex items-center gap-1 text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">
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
                        {expenses.length === 0 && (
                            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="p-3 bg-white rounded-full shadow-sm">
                                        <Wallet size={24} className="text-gray-300" />
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
                onClose={() => setIsExpenseModalOpen(false)}
                group={group}
                onExpenseAdded={fetchGroupData}
            />
        </div>
    );
};

export default GroupDetail;
