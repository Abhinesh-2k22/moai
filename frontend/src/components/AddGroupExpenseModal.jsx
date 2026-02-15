import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { X, DollarSign, Users, FileText, Calendar } from 'lucide-react';

const AddGroupExpenseModal = ({ isOpen, onClose, group, onExpenseAdded, expenseToEdit }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [payerId, setPayerId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);

    const isEditing = !!expenseToEdit;

    useEffect(() => {
        if (isOpen && group) {
            if (isEditing) {
                // Edit Mode: Pre-fill data
                setDescription(expenseToEdit.description);
                setAmount(expenseToEdit.amount);
                setDate(new Date(expenseToEdit.date).toISOString().split('T')[0]);

                // Set Payer
                if (expenseToEdit.payerId) {
                    setPayerId(expenseToEdit.payerId._id);
                } else if (expenseToEdit.payerGuestName) {
                    setPayerId(`guest:${expenseToEdit.payerGuestName}`);
                }

                // Set Split Members
                const splitIds = expenseToEdit.splits.map(s => s.userId ? s.userId._id : `guest:${s.guestName}`);
                setSelectedMemberIds(splitIds);
            } else {
                // Add Mode: Reset and Default
                resetForm();

                // Default select all
                const allIds = group.members.map(m => m.userId ? m.userId._id : `guest:${m.guestName}`);
                setSelectedMemberIds(allIds);

                // Default pay
                if (group.members.length > 0) {
                    const firstMember = group.members[0];
                    setPayerId(firstMember.userId ? firstMember.userId._id : `guest:${firstMember.guestName}`);
                }
            }
        }
    }, [isOpen, group, expenseToEdit]);

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
        setDate(new Date().toISOString().split('T')[0]);
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
            const splitCount = selectedMemberIds.length;
            const splitAmount = parseFloat((totalAmount / splitCount).toFixed(2));

            const splits = selectedMemberIds.map((memberId, index) => {
                const isGuest = memberId.startsWith('guest:');
                const id = isGuest ? null : memberId;
                const guestName = isGuest ? memberId.split(':')[1] : null;

                return {
                    userId: id,
                    guestName: guestName,
                    amount: splitAmount // Simple split for now
                };
            });

            const payload = {
                description,
                amount: totalAmount,
                date,
                splits
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">{isEditing ? 'Edit Expense' : 'Add Group Expense'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Description</label>
                        <div className="relative">
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                placeholder="Dinner, Taxi, etc."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Total Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                            <input
                                type="number"
                                required
                                min="0.01"
                                step="0.01"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-bold text-lg text-gray-800"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Paid By */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Paid By</label>
                        <div className="relative">
                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <select
                                required
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all appearance-none"
                                value={payerId}
                                onChange={(e) => setPayerId(e.target.value)}
                            >
                                <option value="" disabled>Select Payer</option>
                                {group.members.map((member, idx) => {
                                    const value = member.userId ? member.userId._id : `guest:${member.guestName}`;
                                    const label = member.userId ? member.userId.name : `${member.guestName} (Guest)`;
                                    return (
                                        <option key={idx} value={value}>
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
                            <label className="block text-xs font-bold text-gray-500 uppercase">Split With</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedMemberIds(group.members.map(m => m.userId ? m.userId._id : `guest:${m.guestName}`))}
                                    className="text-xs text-indigo-600 font-bold hover:text-indigo-800"
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMemberIds([])}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2 max-h-40 overflow-y-auto">
                            {group.members.map((member, idx) => {
                                const id = member.userId ? member.userId._id : `guest:${member.guestName}`;
                                const name = member.userId ? member.userId.name : `${member.guestName} (Guest)`;
                                const isSelected = selectedMemberIds.includes(id);
                                return (
                                    <div key={idx}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-100'}`}
                                        onClick={() => handleToggleMember(id)}
                                    >
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                                            {isSelected && <Users size={12} className="text-white" />}
                                        </div>
                                        <span className={`text-sm font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-600'}`}>{name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="date"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : (isEditing ? 'Update Expense' : 'Split Expense')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddGroupExpenseModal;
