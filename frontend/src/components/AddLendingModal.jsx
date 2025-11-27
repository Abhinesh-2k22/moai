import React, { useState } from 'react';
import { X, Calendar, DollarSign, User, FileText } from 'lucide-react';
import api from '../api/axios';

const AddLendingModal = ({ isOpen, onClose, onAdded }) => {
    const [formData, setFormData] = useState({
        type: 'lend', // lend or borrow
        otherPersonName: '',
        amount: '',
        description: '',
        dueDate: '',
        date: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/settlements/personal', formData);
            setFormData({
                type: 'lend',
                otherPersonName: '',
                amount: '',
                description: '',
                dueDate: '',
                date: new Date().toISOString().split('T')[0]
            });
            onAdded();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Failed to add transaction');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-800">Record Personal Debt</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Type Selector */}
                    <div className="flex p-1 bg-gray-100 rounded-xl">
                        <button
                            type="button"
                            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${formData.type === 'lend' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setFormData({ ...formData, type: 'lend' })}
                        >
                            I Lent
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${formData.type === 'borrow' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setFormData({ ...formData, type: 'borrow' })}
                        >
                            I Borrowed
                        </button>
                    </div>

                    {/* Person Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Person Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium"
                                placeholder="e.g. John Doe"
                                value={formData.otherPersonName}
                                onChange={(e) => setFormData({ ...formData, otherPersonName: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Amount</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="number"
                                required
                                min="0.01"
                                step="0.01"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Description</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium"
                                placeholder="e.g. Lunch money"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Due Date */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Due Date (Optional)</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="date"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-gray-600"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5"
                    >
                        Record Transaction
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddLendingModal;
