import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import AddTransactionModal from '../components/AddTransactionModal';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Calendar, Tag, Wallet, Clock } from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({
        income: 0,
        expense: 0,
        investmentBuy: 0,
        investmentSell: 0,
        lend: 0,
        borrow: 0
    });
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [txRes, settleRes] = await Promise.all([
                api.get('/transactions'),
                api.get('/settlements')
            ]);

            const allTransactions = txRes.data;
            const settlementsData = settleRes.data;

            setTransactions(allTransactions);

            // Calculate totals for CURRENT MONTH only
            const now = new Date();
            const currentMonthTransactions = allTransactions.filter(tx => {
                const txDate = new Date(tx.date);
                return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
            });

            let income = 0;
            let expense = 0;
            let investmentBuy = 0;
            let investmentSell = 0;

            currentMonthTransactions.forEach(tx => {
                if (tx.category === 'Debt Repayment') return;

                if (tx.type === 'income') income += tx.amount;
                else if (tx.type === 'expense') expense += tx.amount;
                else if (tx.type === 'investment') {
                    if (tx.investmentType === 'buy') investmentBuy += tx.amount;
                    else if (tx.investmentType === 'sell') investmentSell += tx.amount;
                }
            });

            // Calculate To Settle (Borrow) and To Expect (Lend) from SETTLEMENTS API
            let lend = 0;
            let borrow = 0;

            settlementsData.forEach(balance => {
                if (balance.total > 0) {
                    lend += balance.total;
                } else if (balance.total < 0) {
                    borrow += Math.abs(balance.total);
                }
            });

            setSummary({
                income,
                expense,
                investmentBuy,
                investmentSell,
                lend,
                borrow
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            try {
                await api.delete(`/transactions/${id}`);
                fetchData();
            } catch (err) {
                console.error(err);
            }
        }
    };

    // Calculate lifetime balance from all transactions
    const calculateLifetimeBalance = () => {
        let balance = 0;
        transactions.forEach(tx => {
            if (tx.type === 'income') balance += tx.amount;
            else if (tx.type === 'expense') balance -= tx.amount;
            else if (tx.type === 'investment') {
                if (tx.investmentType === 'buy') balance -= tx.amount;
                else if (tx.investmentType === 'sell') balance += tx.amount;
            }
            // Lend reduces cash, Borrow increases cash.
            // Only count unsettled debts — settled ones cancel out.
            else if (tx.type === 'lend' && !tx.isSettled) balance -= tx.amount;
            else if (tx.type === 'borrow' && !tx.isSettled) balance += tx.amount;
        });

        return balance;
    };

    const balance = calculateLifetimeBalance();

    // Calculate recent categories for modal
    const recentCategories = [...new Set(transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => t.category))].slice(0, 5);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome back, {user?.name}!</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 md:px-6 md:py-3 text-sm md:text-base rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-1 cursor-pointer"
                >
                    <Plus size={20} />
                    Add Transaction
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl shadow-sm">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Income</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">₹{summary.income.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl shadow-sm">
                            <TrendingDown size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Expense</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">₹{summary.expense.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl shadow-sm">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Invested</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">₹{((summary.investmentBuy || 0) - (summary.investmentSell || 0)).toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 rounded-xl shadow-sm">
                            <TrendingUp size={24} className="rotate-45" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">To Settle</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">₹{summary.borrow.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl shadow-sm">
                            <TrendingDown size={24} className="rotate-45" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">To Expect</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">₹{summary.lend.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl shadow-sm">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Balance</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">₹{balance.toFixed(0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800/80 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Recent Transactions</h2>
                    <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full">{transactions.length} entries</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50 dark:bg-slate-900/30">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category/Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-full">
                                                <Tag size={32} />
                                            </div>
                                            <p>No transactions found. Start logging your expenses!</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions
                                    .filter(tx => !(['lend', 'borrow'].includes(tx.type) && tx.isSettled))
                                    .map((tx) => (
                                        <tr key={tx._id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 font-medium">
                                                        <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
                                                        {format(new Date(tx.date), 'MMM dd, yyyy')}
                                                    </div>
                                                    <div className="text-xs text-gray-400 dark:text-gray-500 ml-6">
                                                        {format(new Date(tx.date), 'hh:mm a')}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 text-xs font-medium rounded-full border ${
                                                    tx.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100/20' :
                                                    tx.type === 'investment' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100/20' :
                                                    tx.type === 'lend' ? 'bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border-pink-100/20' :
                                                    tx.type === 'borrow' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-100/20' :
                                                    'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100/20'
                                                }`}>
                                                    {tx.type === 'lend' ? 'Lent' : tx.type === 'borrow' ? 'Borrowed' : tx.category || tx.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {tx.description || '-'}
                                                    {tx.status === 'pending' && (
                                                        <span title="Pending Confirmation" className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 p-1 rounded-full">
                                                            <Clock size={14} />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' :
                                                tx.type === 'investment' ? 'text-amber-600 dark:text-amber-400' :
                                                    tx.type === 'lend' ? 'text-pink-600 dark:text-pink-400' :
                                                        tx.type === 'borrow' ? 'text-blue-600 dark:text-blue-400' :
                                                            'text-rose-600 dark:text-rose-400'
                                                }`}>
                                                {tx.type === 'income' || (tx.type === 'investment' && tx.investmentType === 'sell') || tx.type === 'borrow' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleDelete(tx._id)}
                                                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                                                    title="Delete Transaction"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onTransactionAdded={fetchData}
                recentCategories={[...new Set(transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => t.category))].slice(0, 5)}
            />
        </div>
    );
};

export default Dashboard;
