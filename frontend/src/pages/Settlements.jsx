import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const Settlements = () => {
    const { user } = useContext(AuthContext);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('settle'); // 'settle' (I owe) or 'expect' (Owed to me)

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            const res = await api.get('/transactions');
            // Filter for UNSETTLED lend/borrow transactions
            const unsettled = res.data.filter(tx =>
                (tx.type === 'lend' || tx.type === 'borrow') &&
                !tx.isSettled &&
                tx.status === 'confirmed'
            );
            setTransactions(unsettled);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSquareOff = async (tx) => {
        if (!window.confirm(`Request to settle this amount of ₹${tx.amount}?`)) return;

        try {
            // Send notification to the other user
            await api.post('/notifications', {
                recipientUserId: tx.recipientUserId, // The other person
                type: 'settle_request',
                transactionId: tx._id,
                amount: tx.amount,
                description: `Settlement request for: ${tx.description || 'Loan'}`
            });

            // Update local state to show "Requested"
            const updatedTx = { ...tx, settlementStatus: 'requested' };
            setTransactions(transactions.map(t => t._id === tx._id ? updatedTx : t));

            alert('Settlement request sent!');
        } catch (err) {
            console.error(err);
            alert('Failed to send settlement request');
        }
    };

    const handleNotify = async (tx) => {
        try {
            await api.post('/notifications', {
                recipientUserId: tx.recipientUserId,
                type: 'remind',
                transactionId: tx._id,
                amount: tx.amount,
                description: `Reminder for: ${tx.description || 'Loan'}`
            });
            alert('Reminder sent!');
        } catch (err) {
            console.error(err);
            alert('Failed to send reminder');
        }
    };

    const displayedTransactions = transactions.filter(tx =>
        activeTab === 'settle' ? tx.type === 'borrow' : tx.type === 'lend'
    );

    const totalAmount = displayedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Settlements</h1>
                <p className="text-gray-500 mt-1">Manage your debts and receivables</p>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl w-full max-w-md">
                <button
                    onClick={() => setActiveTab('settle')}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === 'settle'
                        ? 'bg-white text-rose-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    To Settle (I Owe)
                </button>
                <button
                    onClick={() => setActiveTab('expect')}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === 'expect'
                        ? 'bg-white text-emerald-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    To Expect (Owed to Me)
                </button>
            </div>

            {/* Total Card */}
            <div className={`glass-card p-8 rounded-2xl text-center ${activeTab === 'settle' ? 'bg-rose-50/50 border-rose-100' : 'bg-emerald-50/50 border-emerald-100'
                }`}>
                <p className="text-gray-500 font-medium uppercase tracking-wide text-xs mb-2">
                    Total Amount {activeTab === 'settle' ? 'You Owe' : 'Owed to You'}
                </p>
                <h2 className={`text-4xl font-bold ${activeTab === 'settle' ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                    ₹{totalAmount.toFixed(2)}
                </h2>
            </div>

            {/* Transactions List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                ) : displayedTransactions.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                        <CheckCircle size={48} className="mx-auto mb-3 opacity-20" />
                        <p>All settled up! Nothing to show here.</p>
                    </div>
                ) : (
                    displayedTransactions.map(tx => (
                        <div key={tx._id} className="glass-card p-5 rounded-xl flex items-center justify-between group hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${activeTab === 'settle' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                    {activeTab === 'settle' ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg">{tx.description || 'Loan'}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                                        <span>{format(new Date(tx.date), 'MMM dd, yyyy')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className={`text-xl font-bold ${activeTab === 'settle' ? 'text-rose-600' : 'text-emerald-600'
                                        }`}>
                                        ₹{tx.amount.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">
                                        {activeTab === 'settle' ? 'Outstanding' : 'Receivable'}
                                    </p>
                                </div>

                                {activeTab === 'settle' ? (
                                    tx.settlementStatus === 'requested' ? (
                                        <button disabled className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg font-bold text-sm cursor-not-allowed flex items-center gap-2">
                                            <Clock size={16} /> Requested
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleSquareOff(tx)}
                                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                        >
                                            Square Off
                                        </button>
                                    )
                                ) : (
                                    <button
                                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-50 transition-colors"
                                        onClick={() => handleNotify(tx)}
                                    >
                                        Notify
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Settlements;
