import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { X, DollarSign, Users, FileText, Calendar } from 'lucide-react';

const AddGroupExpenseModal = ({ isOpen, onClose, group, onExpenseAdded }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [payerId, setPayerId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && group) {
            // Default to current user if they are in the group, otherwise first member
            const me = group.members.find(m => m.userId && m.userId._id === group.createdBy); // Ideally compare with logged in user, but we might not have it here easily without context. 
            // Better: Just default to empty or first member.
            if (group.members.length > 0) {
                const firstMember = group.members[0];
                setPayerId(firstMember.userId ? firstMember.userId._id : `guest:${firstMember.guestName}`);
            }
        }
    }, [isOpen, group]);

    if (!isOpen || !group) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                description,
                amount: parseFloat(amount),
                date
            };

            if (payerId.startsWith('guest:')) {
                payload.payerGuestName = payerId.split(':')[1];
                payload.description = `Paid by ${payload.payerGuestName} - ${description}`;
            } else {
                payload.payerId = payerId;
                const payerMember = group.members.find(m => m.userId && m.userId._id === payerId);
                const payerName = payerMember ? payerMember.userId.name : 'Unknown';
                payload.description = `Paid by ${payerName} - ${description}`;
            }

            await api.post(`/groups/${group._id}/expenses`, payload);
            onExpenseAdded();
            onClose();
            resetForm();
        } catch (err) {
            console.error(err);
            alert('Failed to add expense');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        // Reset payer to default?
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Add Group Expense</h2>
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
                        {loading ? 'Adding...' : 'Split Expense'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddGroupExpenseModal;
