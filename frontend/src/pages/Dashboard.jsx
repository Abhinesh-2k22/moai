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
    const [settlements, setSettlements] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/transactions');
            const allTransactions = res.data;
            setTransactions(allTransactions);

            const resSettlements = await api.get('/settlements/history');
            setSettlements(resSettlements.data);

            // Calculate totals for CURRENT MONTH only (for Income/Expense)
            const now = new Date();
            const currentMonthTransactions = allTransactions.filter(tx => {
                const txDate = new Date(tx.date);
                return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
            });

            let income = 0;
            let expense = 0;
            let investmentBuy = 0;
            let investmentSell = 0;

            // For Income/Expense, use Current Month, but EXCLUDE Debt Repayment if desired (or keep it if it's cash flow)
            // User said: "lending/borrowing should only alter balance and not income or expense"
            // This implies Debt Repayment (which is the result of settlement) might also be excluded?
            // Or maybe just the initial Lend/Borrow.
            // Initial Lend/Borrow are already excluded from Income/Expense below.
            // Let's exclude 'Debt Repayment' category from Income/Expense totals to be safe as per user request.

            currentMonthTransactions.forEach(tx => {
                if (tx.category === 'Debt Repayment') return; // Skip debt repayments for Income/Expense cards

                if (tx.type === 'income') income += tx.amount;
                else if (tx.type === 'expense') expense += tx.amount;
                else if (tx.type === 'investment') {
                    if (tx.investmentType === 'buy') investmentBuy += tx.amount;
                    else if (tx.investmentType === 'sell') investmentSell += tx.amount;
                }
            });

            // Calculate To Settle (Borrow) and To Expect (Lend) from ALL UNSETTLED transactions (Lifetime)
            let lend = 0;
            let borrow = 0;

            allTransactions.forEach(tx => {
                if (!tx.isSettled && tx.status === 'confirmed') {
                    if (tx.type === 'lend') lend += tx.amount;
                    else if (tx.type === 'borrow') borrow += tx.amount;
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

    // Calculate lifetime balance from ALL transactions
    const calculateLifetimeBalance = () => {
        let balance = 0;
        transactions.forEach(tx => {
            if (tx.type === 'income') balance += tx.amount;
            else if (tx.type === 'expense') balance -= tx.amount;
            else if (tx.type === 'investment') {
                if (tx.investmentType === 'buy') balance -= tx.amount;
                else if (tx.investmentType === 'sell') balance += tx.amount;
            }
            // Lend/Borrow don't affect "Net Balance" in the same way as income/expense, 
            // but usually:
            // Lend = Money out (temporarily) -> decreases available cash? 
            // Borrow = Money in (temporarily) -> increases available cash?
            // However, standard Net Worth usually includes money owed to you.
            // For "Wallet Balance" (Cash on hand):
            // Lend reduces cash, Borrow increases cash.
            // Let's assume this is "Net Worth" (Assets - Liabilities)?
            // Or "Cash Flow"?
            // Based on previous logic `summary.income - summary.expense`, it was Cash Flow.
            // Let's stick to Cash Flow logic:
            // Income (+), Expense (-), Invest Buy (-), Invest Sell (+)
            // Lend (-), Borrow (+)

            // WAIT: The previous logic was: income - expense - investBuy + investSell.
            // It ignored Lend/Borrow.
            // If I lend money, my "Net Worth" doesn't change (Cash goes down, Asset "IOU" goes up).
            // But my "Wallet Balance" goes down.
            // The user asked for "Balance". Usually means "Current Balance".
            // If I borrow 100, I have 100 more cash.
            // If I lend 100, I have 100 less cash.
            // Let's include Lend/Borrow in the cash balance for accuracy.

            if (tx.type === 'lend') balance -= tx.amount;
            else if (tx.type === 'borrow') balance += tx.amount;
        });

        // Adjust for Settlements
        if (user) {
            settlements.forEach(settle => {
                // If I paid (fromUserId is me), I lost cash (Balance decreases)
                // BUT wait, if I paid back a debt (Borrow), my Balance was +100 (Borrow).
                // Now I pay -100. Balance = 0. Correct.

                // If I paid a "Lend" request (I am lending)? 
                // No, "Lend" transaction handles the initial cash out.
                // Settlement is only for Repayment of existing debts.

                // Case 1: I borrowed 100. Balance +100.
                // I pay back 100 (Settlement from me). Balance -100. Net 0. Correct.

                // Case 2: I lent 100. Balance -100.
                // They pay me back 100 (Settlement to me). Balance +100. Net 0. Correct.

                const userId = user._id || user.id;

                if (settle.fromUserId === userId) {
                    balance -= settle.amount;
                } else if (settle.toUserId === userId) {
                    balance += settle.amount;
                }
            });
        }

        return balance;
    };

    const balance = calculateLifetimeBalance();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                    <p className="text-gray-500 mt-1">Welcome back, {user?.name}!</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 md:px-6 md:py-3 text-sm md:text-base rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-1"
                >
                    <Plus size={20} />
                    Add Transaction
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Income</p>
                            <p className="text-xl font-bold text-gray-800">₹{summary.income.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
                            <TrendingDown size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Expense</p>
                            <p className="text-xl font-bold text-gray-800">₹{summary.expense.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shadow-sm">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Invested</p>
                            <p className="text-xl font-bold text-gray-800">₹{((summary.investmentBuy || 0) - (summary.investmentSell || 0)).toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-pink-50 text-pink-600 rounded-xl shadow-sm">
                            <TrendingUp size={24} className="rotate-45" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">To Settle</p>
                            <p className="text-xl font-bold text-gray-800">₹{summary.borrow.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-sm">
                            <TrendingDown size={24} className="rotate-45" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">To Expect</p>
                            <p className="text-xl font-bold text-gray-800">₹{summary.lend.toFixed(0)}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Balance</p>
                            <p className="text-xl font-bold text-gray-800">₹{balance.toFixed(0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Recent Transactions</h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{transactions.length} entries</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category/Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <Tag size={32} />
                                            </div>
                                            <p>No transactions found. Start logging your expenses!</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx._id} className="hover:bg-gray-50/80 transition duration-200">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 font-medium">
                                                    <Calendar size={16} className="text-gray-400" />
                                                    {format(new Date(tx.date), 'MMM dd, yyyy')}
                                                </div>
                                                <div className="text-xs text-gray-400 ml-6">
                                                    {format(new Date(tx.date), 'hh:mm a')}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 text-xs font-medium rounded-full border ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                tx.type === 'investment' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    tx.type === 'lend' ? 'bg-pink-50 text-pink-600 border-pink-100' :
                                                        tx.type === 'borrow' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            'bg-rose-50 text-rose-600 border-rose-100'
                                                }`}>
                                                {tx.type === 'lend' ? 'Lent' :
                                                    tx.type === 'borrow' ? 'Borrowed' :
                                                        tx.category || tx.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                                            <div className="flex items-center gap-2">
                                                {tx.description || '-'}
                                                {tx.status === 'pending' && (
                                                    <span title="Pending Confirmation" className="text-amber-500 bg-amber-50 p-1 rounded-full">
                                                        <Clock size={14} />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${tx.type === 'income' ? 'text-emerald-600' :
                                            tx.type === 'investment' ? 'text-amber-600' :
                                                tx.type === 'lend' ? 'text-pink-600' :
                                                    tx.type === 'borrow' ? 'text-blue-600' :
                                                        'text-rose-600'
                                            }`}>
                                            {tx.type === 'income' || (tx.type === 'investment' && tx.investmentType === 'sell') || tx.type === 'borrow' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <button
                                                onClick={() => handleDelete(tx._id)}
                                                className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
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
            />
        </div>
    );
};

export default Dashboard;
