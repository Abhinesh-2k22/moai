import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { Filter, Calendar, TrendingUp, TrendingDown, DollarSign, Wallet, PieChart as PieIcon, Search, ArrowUp, ArrowDown, Trash2, AlertCircle, Loader } from 'lucide-react';
import { format, parseISO, subMonths, subYears, isAfter, startOfYear, getYear, getMonth, startOfMonth, endOfDay } from 'date-fns';

const Analysis = () => {
    // Data State
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Analysis Specific State
    const [barFilter, setBarFilter] = useState('month'); // month (all), year (all)
    const [barData, setBarData] = useState({ income: [], expense: [], investment: [] });
    const [pieData, setPieData] = useState([]);
    const [totals, setTotals] = useState({ income: 0, expense: 0, investment: 0 });

    // History/Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!loading) {
            applyFilters();
            processBarData(); // Bar data uses full history (transactions)
            calculateTotals(); // Totals use full history
        }
    }, [transactions, loading, barFilter]); // Re-run when base data or bar filter changes

    useEffect(() => {
        // Pie data depends on FILTERED transactions
        if (!loading) {
            processPieData();
        }
    }, [filteredTransactions]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [txRes, catRes] = await Promise.all([
                api.get('/transactions'),
                api.get('/categories')
            ]);
            setTransactions(txRes.data);
            setCategories(catRes.data);
        } catch (err) {
            console.error(err);
            setError('Failed to load data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = transactions;

        // Type Filter
        if (typeFilter !== 'all') {
            result = result.filter(tx => tx.type === typeFilter);
        }

        // Category Filter
        if (categoryFilter !== 'all') {
            result = result.filter(tx => tx.category === categoryFilter);
        }

        // Date Range Filter
        if (dateRange.start) {
            result = result.filter(tx => new Date(tx.date) >= new Date(dateRange.start));
        }
        if (dateRange.end) {
            result = result.filter(tx => new Date(tx.date) <= endOfDay(parseISO(dateRange.end)));
        }

        // Search Filter (Description)
        if (searchTerm) {
            result = result.filter(tx =>
                (tx.description && tx.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                tx.category.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredTransactions(result);
    };

    // Re-run filters when filter state changes
    useEffect(() => {
        applyFilters();
    }, [searchTerm, typeFilter, categoryFilter, dateRange]);


    const calculateTotals = () => {
        let income = 0, expense = 0, investment = 0;
        transactions.forEach(tx => {
            if (tx.category === 'Debt Repayment') return;

            if (tx.type === 'income') income += tx.amount;
            else if (tx.type === 'expense') expense += tx.amount;
            else if (tx.type === 'investment') {
                if (tx.investmentType === 'buy') investment += tx.amount;
                else if (tx.investmentType === 'sell') investment -= tx.amount;
            }
        });
        setTotals({ income, expense, investment });
    };

    const processBarData = () => {
        const grouped = {};

        // Use FULL transactions for Bar Charts
        transactions.forEach(tx => {
            const date = parseISO(tx.date);
            let key;

            if (barFilter === 'month') {
                key = format(date, 'MMM yyyy');
            } else {
                key = format(date, 'yyyy');
            }

            if (!grouped[key]) {
                const sortDate = barFilter === 'month' ? startOfMonth(date) : startOfYear(date);
                grouped[key] = { name: key, income: 0, expense: 0, investment: 0, sortDate };
            }

            if (tx.category === 'Debt Repayment') return; // Exclude Debt Repayment from Analysis

            if (tx.type === 'income') grouped[key].income += tx.amount;
            else if (tx.type === 'expense') grouped[key].expense += tx.amount;
            else if (tx.type === 'investment') {
                if (tx.investmentType === 'buy') grouped[key].investment += tx.amount;
                else if (tx.investmentType === 'sell') grouped[key].investment -= tx.amount;
            }
        });

        const sortedData = Object.values(grouped).sort((a, b) => a.sortDate - b.sortDate);
        setBarData({
            income: sortedData,
            expense: sortedData,
            investment: sortedData
        });
    };

    const processPieData = () => {
        // Use FILTERED transactions for Sunburst
        const hierarchy = {
            income: {},
            expense: {},
            investment: {},
            lend: {},
            borrow: {}
        };

        filteredTransactions.forEach(tx => {
            if (!hierarchy[tx.type]) hierarchy[tx.type] = {};

            // For investment, we need to handle buy/sell logic for the TOTAL, 
            // but for the pie chart slices (categories), it's tricky.
            // If we just sum them, Sell reduces the total. 
            // If Net Investment is negative, we can't show it in a Pie Chart.
            // Let's aggregate Investment as a single "Net Investment" slice if positive.

            if (tx.type === 'investment') {
                // We'll handle investment separately below
            } else {
                if (!hierarchy[tx.type][tx.category]) hierarchy[tx.type][tx.category] = 0;
                hierarchy[tx.type][tx.category] += tx.amount;
            }
        });

        // Calculate Net Investment
        let netInvestment = 0;
        filteredTransactions.forEach(tx => {
            if (tx.type === 'investment') {
                if (tx.investmentType === 'buy') netInvestment += tx.amount;
                else if (tx.investmentType === 'sell') netInvestment -= tx.amount;
            }
        });

        const fixedOrder = ['income', 'expense', 'investment', 'lend', 'borrow'];

        const innerData = [];
        const outerData = [];

        fixedOrder.forEach(typeKey => {
            let typeTotal = 0;

            if (typeKey === 'investment') {
                typeTotal = netInvestment;
            } else {
                typeTotal = Object.values(hierarchy[typeKey] || {}).reduce((a, b) => a + b, 0);
            }

            if (typeTotal > 0) {
                let name = typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
                let fill;
                if (typeKey === 'income') fill = '#10B981';
                else if (typeKey === 'expense') fill = '#F43F5E';
                else if (typeKey === 'investment') fill = '#F59E0B';
                else if (typeKey === 'lend') fill = '#EC4899'; // Pink
                else if (typeKey === 'borrow') fill = '#3B82F6'; // Blue

                innerData.push({ name, value: typeTotal, fill });

                // Outer ring for categories
                if (typeKey === 'investment') {
                    // Just one outer slice for Investment
                    outerData.push({
                        name: 'Net Invested',
                        value: typeTotal,
                        type: name,
                        fill: '#FCD34D'
                    });
                } else {
                    const categories = hierarchy[typeKey];
                    const sortedCats = Object.entries(categories)
                        .map(([name, value]) => ({ name, value }))
                        .filter(c => c.value > 0)
                        .sort((a, b) => b.value - a.value);

                    sortedCats.forEach(cat => {
                        let catFill;
                        if (typeKey === 'income') catFill = '#34D399';
                        else if (typeKey === 'expense') catFill = '#FB7185';
                        else if (typeKey === 'lend') catFill = '#FBCFE8';
                        else if (typeKey === 'borrow') catFill = '#BFDBFE';
                        else catFill = '#FCD34D';

                        outerData.push({
                            name: cat.name || (typeKey === 'lend' ? 'Lending' : 'Borrowing'),
                            value: cat.value,
                            type: name,
                            fill: catFill
                        });
                    });
                }
            }
        });

        setPieData({ inner: innerData, outer: outerData });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            try {
                await api.delete(`/transactions/${id}`);
                fetchData(); // Reload all data
            } catch (err) {
                console.error(err);
                alert('Failed to delete transaction');
            }
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setTypeFilter('all');
        setCategoryFilter('all');
        setDateRange({ start: '', end: '' });
    };

    const setQuickFilter = (period) => {
        const end = format(new Date(), 'yyyy-MM-dd');
        let start;

        if (period === 'month') {
            start = format(subMonths(new Date(), 1), 'yyyy-MM-dd');
        } else if (period === 'ongoing') {
            start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        } else if (period === 'quarter') {
            start = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
        } else if (period === 'year') {
            start = format(subYears(new Date(), 1), 'yyyy-MM-dd');
        }

        setDateRange({ start, end });
    };

    const SummaryCard = ({ title, amount, color, icon: Icon }) => (
        <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
                    <Icon size={24} />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className={`text-2xl font-bold text-${color}-600 mt-1`}>₹{amount.toFixed(2)}</p>
                </div>
            </div>
        </div>
    );

    const renderBarChart = (title, dataKey, color, icon) => (
        <div className="glass-card p-6 rounded-2xl mb-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
                        {icon}
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                </div>
            </div>

            <div className="overflow-x-auto pb-4">
                <div className="h-80" style={{ minWidth: `${Math.max(600, barData[dataKey].length * 60)}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData[dataKey]} barGap={8} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#f8fafc' }}
                                formatter={(value) => [`₹${value.toFixed(2)}`, 'Amount']}
                            />
                            <Bar
                                dataKey={dataKey}
                                fill={color === 'emerald' ? '#10B981' : color === 'rose' ? '#F43F5E' : '#F59E0B'}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={50}
                                animationDuration={1000}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4 text-indigo-600">
                    <Loader size={48} className="animate-spin" />
                    <p className="font-medium">Loading analysis...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4 text-rose-500">
                    <AlertCircle size={48} />
                    <p className="font-medium text-lg">{error}</p>
                    <button onClick={fetchData} className="px-6 py-2 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Financial Analysis</h1>
                    <p className="text-gray-500 mt-1">Deep dive into your spending habits</p>
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    {['month', 'year'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setBarFilter(f)}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${barFilter === f
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            {f === 'month' ? 'Monthly' : 'Yearly'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard title="Total Income" amount={totals.income} color="emerald" icon={TrendingUp} />
                <SummaryCard title="Total Expense" amount={totals.expense} color="rose" icon={TrendingDown} />
                <SummaryCard title="Total Investment" amount={totals.investment} color="amber" icon={DollarSign} />
                <SummaryCard
                    title="Net Balance"
                    amount={totals.income - totals.expense - totals.investment}
                    color="indigo"
                    icon={Wallet}
                />
            </div>

            {/* Trend Charts */}
            {renderBarChart('Income Trend', 'income', 'emerald', <TrendingUp size={24} />)}
            {renderBarChart('Expense Trend', 'expense', 'rose', <TrendingDown size={24} />)}
            {renderBarChart('Investment Trend', 'investment', 'amber', <DollarSign size={24} />)}

            {/* HISTORY SECTION (Filters & Table) */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                        <Filter size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Detailed Transaction History</h2>
                </div>

                {/* Filters */}
                <div className="glass-card p-6 rounded-2xl space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                            <select
                                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-w-[140px]"
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                            >
                                <option value="all">All Types</option>
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                                <option value="investment">Investment</option>
                                <option value="lend">Lend</option>
                                <option value="borrow">Borrow</option>
                            </select>
                            <select
                                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-w-[160px]"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="all">All Categories</option>
                                {categories
                                    .filter(c => typeFilter === 'all' || c.type === typeFilter)
                                    .map(c => (
                                        <option key={c._id} value={c.name}>{c.name}</option>
                                    ))
                                }
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                <Calendar size={16} className="text-gray-400" />
                                <input
                                    type="date"
                                    className="bg-transparent outline-none text-sm text-gray-600"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    className="bg-transparent outline-none text-sm text-gray-600"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => setQuickFilter('month')} className="px-3 py-2 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">Past Month</button>
                                <button onClick={() => setQuickFilter('ongoing')} className="px-3 py-2 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">Ongoing Month</button>
                                <button onClick={() => setQuickFilter('quarter')} className="px-3 py-2 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">Past Quarter</button>
                                <button onClick={() => setQuickFilter('year')} className="px-3 py-2 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">Past Year</button>
                            </div>

                            {(searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' || dateRange.start || dateRange.end) && (
                                <button
                                    onClick={clearFilters}
                                    className="text-sm text-rose-500 hover:text-rose-700 font-medium px-3 py-2 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm font-medium whitespace-nowrap">
                            <div className="text-gray-500">
                                Showing {filteredTransactions.length} transactions
                            </div>
                            <div className="bg-indigo-50 px-3 py-1 rounded-lg text-indigo-700">
                                Net Total: <span className="font-bold">
                                    ₹{filteredTransactions.reduce((acc, tx) => {
                                        if (tx.category === 'Debt Repayment') return acc;
                                        if (tx.type === 'income' || (tx.type === 'investment' && tx.investmentType === 'sell') || tx.type === 'borrow') {
                                            return acc + tx.amount;
                                        } else {
                                            return acc - tx.amount;
                                        }
                                    }, 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="glass-card rounded-2xl overflow-hidden max-h-[500px] overflow-y-auto">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="p-4 bg-gray-50 rounded-full">
                                                    <Filter size={32} />
                                                </div>
                                                <p>No transactions match your filters.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((tx) => (
                                        <tr key={tx._id} className="hover:bg-gray-50/80 transition duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-gray-400" />
                                                    {format(new Date(tx.date), 'MMM dd, yyyy')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {tx.type === 'income' && (
                                                    <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold uppercase">
                                                        <ArrowUp size={14} /> Income
                                                    </span>
                                                )}
                                                {tx.type === 'expense' && (
                                                    <span className="flex items-center gap-1 text-rose-600 text-xs font-bold uppercase">
                                                        <ArrowDown size={14} /> Expense
                                                    </span>
                                                )}
                                                {tx.type === 'investment' && (
                                                    <span className="flex items-center gap-1 text-amber-600 text-xs font-bold uppercase">
                                                        <DollarSign size={14} /> {tx.investmentType === 'buy' ? 'Invest (Buy)' : 'Invest (Sell)'}
                                                    </span>
                                                )}
                                                {tx.type === 'lend' && (
                                                    <span className="flex items-center gap-1 text-pink-600 text-xs font-bold uppercase">
                                                        <TrendingUp size={14} className="rotate-45" /> Lend
                                                    </span>
                                                )}
                                                {tx.type === 'borrow' && (
                                                    <span className="flex items-center gap-1 text-blue-600 text-xs font-bold uppercase">
                                                        <TrendingDown size={14} className="rotate-45" /> Borrow
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 text-xs font-medium rounded-full border ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    tx.type === 'investment' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        tx.type === 'lend' ? 'bg-pink-50 text-pink-600 border-pink-100' :
                                                            tx.type === 'borrow' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                'bg-rose-50 text-rose-600 border-rose-100'
                                                    }`}>
                                                    {tx.type === 'lend' ? 'Debt' :
                                                        tx.type === 'borrow' ? 'Debt' :
                                                            tx.category || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                                                {tx.description || '-'}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${tx.type === 'income' ? 'text-emerald-600' :
                                                tx.type === 'investment' ? 'text-amber-600' :
                                                    tx.type === 'lend' ? 'text-pink-600' :
                                                        tx.type === 'borrow' ? 'text-blue-600' :
                                                            'text-rose-600'
                                                }`}>
                                                {tx.type === 'income' || (tx.type === 'investment' && tx.investmentType === 'sell') ? '+' : '-'}₹{tx.amount.toFixed(2)}
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
            </div>

            {/* Sunburst Chart */}
            <div className="glass-card p-8 rounded-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                            <PieIcon size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Category Distribution (Filtered)</h2>
                    </div>
                    {/* Removed independent pie filters as it now uses the main filters */}
                </div>

                <div className="h-96 w-full flex justify-center">
                    {pieData.inner && pieData.inner.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip
                                    formatter={(value, name, props) => [
                                        `₹${value.toFixed(2)}`,
                                        props.payload.type ? `${props.payload.type} - ${name}` : name
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                {/* Inner Pie: Types */}
                                <Pie
                                    data={pieData.inner}
                                    dataKey="value"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    startAngle={90}
                                    endAngle={-270}
                                    isAnimationActive={false}
                                >
                                    {pieData.inner.map((entry, index) => (
                                        <Cell key={`cell-inner-${index}`} fill={entry.fill} stroke="white" strokeWidth={2} />
                                    ))}
                                </Pie>
                                {/* Outer Pie: Categories */}
                                <Pie
                                    data={pieData.outer}
                                    dataKey="value"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={90}
                                    outerRadius={130}
                                    fill="#82ca9d"
                                    startAngle={90}
                                    endAngle={-270}
                                    isAnimationActive={false}
                                    label={({ name, percent }) => percent > 0.05 ? name : ''}
                                >
                                    {pieData.outer.map((entry, index) => (
                                        <Cell key={`cell-outer-${index}`} fill={entry.fill} stroke="white" strokeWidth={1} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <PieIcon size={48} className="mb-4 opacity-20" />
                            <p>No data matches the current filters</p>
                        </div>
                    )}
                </div>
                <div className="mt-4 text-center text-sm text-gray-500">
                    Inner Circle: Type (Income/Expense/Investment) | Outer Circle: Categories
                </div>
            </div>
        </div>
    );
};

export default Analysis;
