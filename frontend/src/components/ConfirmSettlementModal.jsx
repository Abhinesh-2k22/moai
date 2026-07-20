import React from 'react';
import { X, Wallet } from 'lucide-react';

const ConfirmSettlementModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    amount, 
    paymentMethods, 
    paymentMethodId, 
    setPaymentMethodId, 
    loading 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-slate-800/80 animate-scale-up">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Wallet className="text-indigo-500" />
                        {title || 'Confirm Settlement'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="mb-6">
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                        {message}
                    </p>
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 mb-4 flex justify-between items-center">
                        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wide">Amount to Settle</span>
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                            ₹{Math.abs(amount).toFixed(2)}
                        </span>
                    </div>

                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                        Select Payment Method
                    </label>
                    <select
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all appearance-none cursor-pointer"
                        value={paymentMethodId}
                        onChange={(e) => setPaymentMethodId(e.target.value)}
                    >
                        {paymentMethods.map(pm => (
                            <option key={pm._id} value={pm._id} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                                {pm.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all cursor-pointer"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/30 cursor-pointer disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmSettlementModal;
