import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector, Treemap } from 'recharts';
import { Filter, Calendar, TrendingUp, TrendingDown, DollarSign, Wallet, PieChart as PieIcon, Search, ArrowUp, ArrowDown, Trash2, AlertCircle, Loader, Download, Grid, ChevronLeft, ChevronRight, Target, Info } from 'lucide-react';
import { format, subMonths, subYears, startOfYear, startOfMonth, endOfDay, parseISO, subDays, addDays } from 'date-fns';
import CategoryDropdown from '../components/CategoryDropdown';
import { ThemeContext } from '../context/ThemeContext';

const PIE_COLORS = ['#BE123C', '#E11D48', '#F43F5E', '#FB7185', '#FDA4AF', '#FECDD3', '#881337', '#9F1239'];

const Analysis = () => {
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';

    // Data State
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Analysis Specific State
    const [barFilter, setBarFilter] = useState('month'); // month (all), year (all)
    const [barData, setBarData] = useState({ combined: [] });
    const [pieData, setPieData] = useState([]);
    const [totals, setTotals] = useState({ income: 0, expense: 0, investment: 0 });
    const [prevTotals, setPrevTotals] = useState({ income: 0, expense: 0, investment: 0 });

    const [chartSeries, setChartSeries] = useState({ income: true, expense: true, investment: true, net: true, cumulativeNet: true });
    const [activeTooltip, setActiveTooltip] = useState(null);

    // History/Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
    const [groupFilter, setGroupFilter] = useState('all');
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedTxIds, setSelectedTxIds] = useState([]);

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

    async function fetchData() {
        setLoading(true);
        setError(null);
        try {
            const [txRes, catRes, pmRes, grpRes] = await Promise.all([
                api.get('/transactions'),
                api.get('/categories'),
                api.get('/payment-methods/ensure-defaults'),
                api.get('/groups')
            ]);
            setTransactions(txRes.data);
            setCategories(catRes.data);
            setPaymentMethods(pmRes.data);
            setGroups(grpRes.data);
        } catch (err) {
            console.error(err);
            setError('Failed to load data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    function applyFilters() {
        let result = transactions;

        // Type Filter
        if (typeFilter !== 'all') {
            result = result.filter(tx => tx.type === typeFilter);
        }

        // Category Filter
        if (categoryFilter !== 'all') {
            result = result.filter(tx => tx.category === categoryFilter);
        }

        if (paymentMethodFilter !== 'all') {
            result = result.filter(tx => (tx.paymentMethodName || 'Unspecified') === paymentMethodFilter);
        }

        // Group Filter
        if (groupFilter !== 'all') {
            if (groupFilter === 'personal') {
                result = result.filter(tx => !tx.isGroupExpense);
            } else {
                result = result.filter(tx => tx.groupId === groupFilter);
            }
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
        setSelectedTxIds(result.map(tx => tx._id));
    };

    // Re-run filters when filter state changes
    useEffect(() => {
        applyFilters();
    }, [searchTerm, typeFilter, categoryFilter, paymentMethodFilter, groupFilter, dateRange]);


    function calculateTotals() {
        let income = 0, expense = 0, investment = 0;
        let pIncome = 0, pExpense = 0, pInvestment = 0;
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevYear = currentYear - 1;

        transactions.forEach(tx => {
            if (tx.category === 'Debt Repayment') return;

            const txDate = new Date(tx.date);
            const m = txDate.getMonth();
            const y = txDate.getFullYear();

            let isCurrent = false;
            let isPrev = false;

            if (barFilter === 'month') {
                if (m === currentMonth && y === currentYear) isCurrent = true;
                if (m === prevMonth && y === prevMonthYear) isPrev = true;
            } else if (barFilter === 'year') {
                if (y === currentYear) isCurrent = true;
                if (y === prevYear) isPrev = true;
            }

            if (isCurrent) {
                if (tx.type === 'income') income += tx.amount;
                else if (tx.type === 'expense') expense += tx.amount;
                else if (tx.type === 'investment') {
                    if (tx.investmentType === 'buy') investment += tx.amount;
                    else if (tx.investmentType === 'sell') investment -= tx.amount;
                }
            } else if (isPrev) {
                if (tx.type === 'income') pIncome += tx.amount;
                else if (tx.type === 'expense') pExpense += tx.amount;
                else if (tx.type === 'investment') {
                    if (tx.investmentType === 'buy') pInvestment += tx.amount;
                    else if (tx.investmentType === 'sell') pInvestment -= tx.amount;
                }
            }
        });
        setTotals({ income, expense, investment });
        setPrevTotals({ income: pIncome, expense: pExpense, investment: pInvestment });
    };

    function processBarData() {
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
                grouped[key] = { name: key, income: 0, expense: 0, investment: 0, net: 0, sortDate };
            }

            if (tx.category === 'Debt Repayment') return; // Exclude Debt Repayment from Analysis

            if (tx.type === 'income') grouped[key].income += tx.amount;
            else if (tx.type === 'expense') grouped[key].expense += tx.amount;
            else if (tx.type === 'investment') {
                if (tx.investmentType === 'buy') grouped[key].investment += tx.amount;
                else if (tx.investmentType === 'sell') grouped[key].investment -= tx.amount;
            }
        });

        let runningNet = 0;
        const sortedData = Object.values(grouped).sort((a, b) => a.sortDate - b.sortDate).map(item => {
            const net = item.income - item.expense - item.investment;
            runningNet += net;
            return {
                ...item,
                net,
                cumulativeNet: runningNet
            };
        });

        setBarData({
            combined: sortedData
        });
    };

    function processPieData() {
        const hierarchy = {};

        // Gradient Scales (Darkest/Most Intense -> Lightest)
        const COLOR_SCALES = {
            'income': ['#047857', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0'], // Emeralds
            'expense': ['#BE123C', '#E11D48', '#F43F5E', '#FB7185', '#FDA4AF', '#FECDD3'], // Roses
            'investment': ['#B45309', '#D97706', '#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A'], // Ambers
            'lend': ['#BE185D', '#DB2777', '#EC4899', '#F472B6', '#FBCFE8', '#FCE7F3'], // Pinks
            'borrow': ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'], // Blues
        };

        filteredTransactions.forEach(tx => {
            if (tx.category === 'Debt Repayment') return;

            const typeKey = tx.type === 'investment' && tx.investmentType === 'sell' ? 'income' :
                tx.type === 'investment' ? 'investment' : tx.type;

            if (!hierarchy[typeKey]) hierarchy[typeKey] = {};
            if (!hierarchy[typeKey][tx.category]) hierarchy[typeKey][tx.category] = 0;

            hierarchy[typeKey][tx.category] += Math.abs(tx.amount);
        });

        const data = Object.entries(hierarchy).map(([type, categories]) => {
            // Sort by value DESC
            const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
            const scale = COLOR_SCALES[type] || ['#8884d8'];

            return {
                name: type.charAt(0).toUpperCase() + type.slice(1),
                children: sortedCats.map(([catName, value], index) => ({
                    name: catName,
                    size: value,
                    // Assign color based on rank (index). Clamp to last color if many items.
                    fill: scale[Math.min(index, scale.length - 1)]
                }))
            };
        });

        setPieData(data);
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
        setPaymentMethodFilter('all');
        setGroupFilter('all');
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

    const downloadCSV = () => {
        if (filteredTransactions.length === 0) return;

        const headers = ["Date", "Type", "Category", "Description", "Amount"];
        const rows = filteredTransactions.map(tx => {
            const date = format(new Date(tx.date), 'yyyy-MM-dd');
            const amount = tx.amount.toFixed(2);

            return [
                date,
                tx.type,
                tx.category,
                `"${(tx.description || '').replace(/"/g, '""')}"`, // Handle quotes in description
                amount
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `transactions_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const SummaryCard = ({ title, amount, prevAmount, color, icon: Icon }) => {
        const diff = prevAmount === 0 ? (amount > 0 ? 100 : 0) : ((amount - prevAmount) / prevAmount) * 100;
        const isPositive = diff > 0;
        const showTrend = prevAmount > 0 || amount > 0;
        
        return (
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl bg-${color}-50 dark:bg-${color}-950/30 text-${color}-600 dark:text-${color}-400`}>
                        <Icon size={24} />
                    </div>
                    {showTrend && (
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                            diff === 0 ? 'bg-gray-50 text-gray-500 dark:bg-slate-800 dark:text-gray-400' :
                            ((color === 'rose' && !isPositive) || (color !== 'rose' && isPositive)) 
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' 
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                        }`}>
                            {diff > 0 ? <TrendingUp size={12} /> : diff < 0 ? <TrendingDown size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                            {diff > 0 ? '+' : diff < 0 ? '-' : ''}{Math.abs(diff).toFixed(1)}% {diff > 0 ? 'Rose' : diff < 0 ? 'Dropped' : 'Stable'}
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                    <p className={`text-3xl font-extrabold text-${color}-600 dark:text-${color}-400 mt-1`}>₹{amount.toFixed(2)}</p>
                </div>
                <div className={`absolute -right-6 -bottom-6 opacity-5 dark:opacity-10 text-${color}-600 transform group-hover:scale-110 transition-transform duration-500`}>
                    <Icon size={120} />
                </div>
            </div>
        );
    };

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
                    <button onClick={fetchData} className="px-6 py-2 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition-colors cursor-pointer">Retry</button>
                </div>
            </div>
        );
    }

    // Calculate specific recent categories for Analysis (True LRU)
    const recentCategories = [...new Set(transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => t.category))].slice(0, 5);

    // Advanced Financial Health Metrics calculations
    const savings = totals.income - totals.expense - totals.investment;
    const prevSavings = prevTotals.income - prevTotals.expense - prevTotals.investment;
    const investmentRatio = totals.income > 0 ? (totals.investment / totals.income) * 100 : 0;
    const expenseRatio = totals.income > 0 ? (totals.expense / totals.income) * 100 : 0;

    const getDaysInPeriod = () => {
        if (barFilter === 'month') {
            const now = new Date();
            return now.getDate() || 1;
        } else {
            return 365;
        }
    };
    const daysInPeriod = getDaysInPeriod();
    const averageDailyExpense = totals.expense / daysInPeriod;
    
    // Emergency Runway
    const netBalanceAllTime = transactions.reduce((acc, tx) => {
        if (tx.category === 'Debt Repayment') return acc;
        if (tx.type === 'income' || (tx.type === 'investment' && tx.investmentType === 'sell') || tx.type === 'borrow') return acc + tx.amount;
        return acc - tx.amount;
    }, 0);
    const averageMonthlyExpense = averageDailyExpense * 30;
    const runwayMonths = averageMonthlyExpense > 0 ? Math.max(0, netBalanceAllTime / averageMonthlyExpense) : 0;

    // 30-Day Expense Breakdown calculations
    const currentPeriodEnd = endOfDay(new Date());
    const currentPeriodStart = subDays(currentPeriodEnd, 30);
    const prevPeriodStart = subDays(currentPeriodEnd, 60);

    const current30DaysTx = transactions.filter(tx => {
        if (tx.type !== 'expense' || tx.category === 'Debt Repayment') return false;
        const txDate = new Date(tx.date);
        return txDate > currentPeriodStart && txDate <= currentPeriodEnd;
    });

    const prev30DaysTx = transactions.filter(tx => {
        if (tx.type !== 'expense' || tx.category === 'Debt Repayment') return false;
        const txDate = new Date(tx.date);
        return txDate > prevPeriodStart && txDate <= currentPeriodStart;
    });

    let currentTotalSpent = 0;
    const currentCategoryTotals = {};
    current30DaysTx.forEach(tx => {
        currentCategoryTotals[tx.category] = (currentCategoryTotals[tx.category] || 0) + tx.amount;
        currentTotalSpent += tx.amount;
    });

    const prevCategoryTotals = {};
    let prevTotalSpent = 0;
    prev30DaysTx.forEach(tx => {
        prevCategoryTotals[tx.category] = (prevCategoryTotals[tx.category] || 0) + tx.amount;
        prevTotalSpent += tx.amount;
    });

    const categoryComparison = Object.entries(currentCategoryTotals).map(([category, amount]) => {
        const prevAmount = prevCategoryTotals[category] || 0;
        const diff = prevAmount === 0 ? (amount > 0 ? 100 : 0) : ((amount - prevAmount) / prevAmount) * 100;
        return {
            name: category,
            amount,
            prevAmount,
            diff,
            isNew: prevAmount === 0
        };
    }).sort((a, b) => b.amount - a.amount);

    const overallDiff = prevTotalSpent === 0 ? (currentTotalSpent > 0 ? 100 : 0) : ((currentTotalSpent - prevTotalSpent) / prevTotalSpent) * 100;
    const showOverallTrend = prevTotalSpent > 0 || currentTotalSpent > 0;

    const donutData = categoryComparison.map((c, i) => ({
        name: c.name,
        value: c.amount,
        fill: PIE_COLORS[i % PIE_COLORS.length]
    }));

    const periodTransactions = [...current30DaysTx].sort((a, b) => new Date(b.date) - new Date(a.date));



    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Financial Analysis</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Deep dive into your financial health</p>
                </div>

                <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                    {['month', 'year'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setBarFilter(f)}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${barFilter === f
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            {f === 'month' ? 'Monthly' : 'Yearly'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard title={`Income (${barFilter === 'month' ? 'Month' : 'Year'})`} amount={totals.income} prevAmount={prevTotals.income} color="emerald" icon={TrendingUp} />
                <SummaryCard title={`Expense (${barFilter === 'month' ? 'Month' : 'Year'})`} amount={totals.expense} prevAmount={prevTotals.expense} color="rose" icon={TrendingDown} />
                <SummaryCard title={`Investment (${barFilter === 'month' ? 'Month' : 'Year'})`} amount={totals.investment} prevAmount={prevTotals.investment} color="amber" icon={DollarSign} />
                <SummaryCard title={`Net Balance (${barFilter === 'month' ? 'Month' : 'Year'})`} amount={savings} prevAmount={prevSavings} color="indigo" icon={Wallet} />
            </div>            {/* Advanced Financial Health Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-40">

                {/* Expense Ratio Card */}
                <div className={`glass-card p-6 rounded-2xl relative transition-all duration-300 ${activeTooltip === 'expense' ? 'z-50' : 'z-10'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wider">Expense Ratio</h3>
                        <div className="relative">
                            <button
                                onMouseEnter={() => setActiveTooltip('expense')}
                                onMouseLeave={() => setActiveTooltip(null)}
                                onClick={() => setActiveTooltip(activeTooltip === 'expense' ? null : 'expense')}
                                className="text-gray-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                                title="Learn more about Expense Ratio"
                            >
                                <Info size={14} />
                            </button>
                            {activeTooltip === 'expense' && (
                                <div className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 top-8 z-[100] w-[260px] sm:w-80 p-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-2xl text-xs text-gray-600 dark:text-gray-300 font-medium normal-case leading-relaxed animate-fade-in">
                                    <p className="font-bold text-gray-800 dark:text-white mb-1">Expense Ratio</p>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="font-bold text-gray-700 dark:text-gray-300">Explanation:</span> Tracks the proportion of your incoming money that goes directly towards living expenses. A lower ratio means you are living below your means.
                                        </div>
                                        <div className="pt-2 border-t border-gray-100 dark:border-slate-700 text-[10px] text-gray-400 dark:text-gray-550">
                                            <strong>Mathematical Formula:</strong><br/>
                                            <code className="text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-950/30 px-1.5 py-1 rounded mt-1 mb-2 block break-words whitespace-pre-wrap w-full text-center">Expense_Ratio = (Σ Expenses ÷ Σ Income) × 100</code>
                                            <strong>Calculation:</strong> (₹{totals.expense.toFixed(0)} / ₹{totals.income.toFixed(0) || 1}) * 100 = {expenseRatio.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-extrabold text-rose-600 dark:text-rose-455">
                            {expenseRatio.toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">of income spent</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                        <div 
                            className={`${expenseRatio > 80 ? 'bg-rose-500' : expenseRatio > 50 ? 'bg-amber-500' : 'bg-emerald-500'} h-2 rounded-full transition-all duration-1000`} 
                            style={{ width: `${Math.max(0, Math.min(100, expenseRatio))}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-550 mt-2 font-medium">
                        {expenseRatio <= 50 ? "🎉 Living below means! (50/30/20 Rule)" : expenseRatio <= 80 ? "💡 Moderate spending." : "⚠️ High expense ratio, reduce costs."}
                    </p>
                    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                        <PieIcon className="absolute -right-4 -bottom-4 text-rose-500 opacity-5" size={80} />
                    </div>
                </div>

                {/* Investment Ratio Card */}
                <div className={`glass-card p-6 rounded-2xl relative transition-all duration-300 ${activeTooltip === 'investment' ? 'z-50' : 'z-10'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wider">Investment Ratio</h3>
                        <div className="relative">
                            <button
                                onMouseEnter={() => setActiveTooltip('investment')}
                                onMouseLeave={() => setActiveTooltip(null)}
                                onClick={() => setActiveTooltip(activeTooltip === 'investment' ? null : 'investment')}
                                className="text-gray-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                                title="Learn more about Investment Ratio"
                            >
                                <Info size={14} />
                            </button>
                            {activeTooltip === 'investment' && (
                                <div className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 top-8 z-[100] w-[260px] sm:w-80 p-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-2xl text-xs text-gray-600 dark:text-gray-300 font-medium normal-case leading-relaxed animate-fade-in">
                                    <p className="font-bold text-gray-800 dark:text-white mb-1">Investment Ratio</p>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="font-bold text-gray-700 dark:text-gray-300">Explanation:</span> Measures the portion of your income that is routed into assets to grow your wealth rather than being spent on immediate needs.
                                        </div>
                                        <div className="pt-2 border-t border-gray-100 dark:border-slate-700 text-[10px] text-gray-400 dark:text-gray-550">
                                            <strong>Mathematical Formula:</strong><br/>
                                            <code className="text-amber-600 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-950/30 px-1.5 py-1 rounded mt-1 mb-2 block break-words whitespace-pre-wrap w-full text-center">Investment_Ratio = (Σ Investments ÷ Σ Income) × 100</code>
                                            <strong>Calculation:</strong> (₹{totals.investment.toFixed(0)} / ₹{totals.income.toFixed(0) || 1}) * 100 = {investmentRatio.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-extrabold text-amber-600 dark:text-amber-400">
                            {investmentRatio.toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">of income put to work</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                        <div 
                            className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full transition-all duration-1000" 
                            style={{ width: `${Math.max(0, Math.min(100, investmentRatio))}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-550 mt-2 font-medium">
                        {investmentRatio >= 20 ? "💪 Excellent job investing in your future!" : "🌱 Consider routing more towards assets."}
                    </p>
                    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                        <TrendingUp className="absolute -right-4 -bottom-4 text-amber-500 opacity-5" size={80} />
                    </div>
                </div>
            </div>

            {/* Unified Trend Chart */}
            <div className="glass-card p-6 rounded-2xl mb-8">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                            <TrendingUp size={24} />
                        </div>
                        <div className="flex items-center gap-2">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    Cash Flow & Trends
                                    <div className="relative group">
                                        <Info size={16} className="text-gray-400 hover:text-indigo-500 cursor-pointer" />
                                        <div className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-8 z-[100] w-[260px] sm:w-80 p-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-2xl text-xs text-gray-600 dark:text-gray-300 font-medium normal-case leading-relaxed hidden group-hover:block">
                                            <p className="font-bold text-gray-800 dark:text-white mb-4">Metrics Explained</p>
                                            <ul className="space-y-5 list-none p-0">
                                                <li>
                                                    <strong>Net Cash Flow:</strong><br/>
                                                    <span className="text-[11px] text-gray-500">Money saved or lost during that specific single period.</span><br/>
                                                    <code className="text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-1 rounded text-[10px] block break-words whitespace-pre-wrap w-full mt-1 text-center">Net_Cash_Flow = Σ Income - Σ Expenses</code>
                                                </li>
                                                <li>
                                                    <strong>Cumulative Net:</strong><br/>
                                                    <span className="text-[11px] text-gray-500">Your total accumulated wealth over time, adding each period's net flow to a running total.</span><br/>
                                                    <code className="text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-950/30 px-1.5 py-1 rounded text-[10px] block break-words whitespace-pre-wrap w-full mt-1 text-center">Cumulative_Net = Σ (Net_Cash_Flow_i)</code>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Analyze your money flow over time</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Toggles */}
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setChartSeries(s => ({...s, income: !s.income}))} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${chartSeries.income ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-transparent text-gray-400 border-gray-200 dark:border-slate-800'}`}>Income</button>
                        <button onClick={() => setChartSeries(s => ({...s, expense: !s.expense}))} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${chartSeries.expense ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' : 'bg-transparent text-gray-400 border-gray-200 dark:border-slate-800'}`}>Expense</button>
                        <button onClick={() => setChartSeries(s => ({...s, investment: !s.investment}))} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${chartSeries.investment ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : 'bg-transparent text-gray-400 border-gray-200 dark:border-slate-800'}`}>Investment</button>
                        <button onClick={() => setChartSeries(s => ({...s, net: !s.net}))} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${chartSeries.net ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'bg-transparent text-gray-400 border-gray-200 dark:border-slate-800'}`}>Net Cash Flow</button>
                        <button onClick={() => setChartSeries(s => ({...s, cumulativeNet: !s.cumulativeNet}))} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${chartSeries.cumulativeNet ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' : 'bg-transparent text-gray-400 border-gray-200 dark:border-slate-800'}`}>Cumulative Net</button>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4">
                    <div className="h-96" style={{ minWidth: `${Math.max(600, barData.combined.length * 90)}px` }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={barData.combined} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                        color: isDark ? '#f8fafc' : '#1e293b',
                                        fontWeight: 'bold'
                                    }}
                                    cursor={{ fill: isDark ? 'rgba(51, 65, 85, 0.2)' : '#f8fafc' }}
                                    formatter={(value) => [`₹${value.toFixed(2)}`]}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                
                                {chartSeries.income && <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />}
                                {chartSeries.expense && <Bar dataKey="expense" name="Expense" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />}
                                {chartSeries.investment && <Bar dataKey="investment" name="Investment" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />}
                                
                                {chartSeries.net && (
                                    <Line 
                                        type="monotone" 
                                        dataKey="net" 
                                        name="Net Cash Flow" 
                                        stroke="#6366F1" 
                                        strokeWidth={4} 
                                        dot={{ r: 5, strokeWidth: 2, fill: isDark ? '#1e293b' : '#ffffff' }} 
                                        activeDot={{ r: 8, stroke: '#6366F1', strokeWidth: 2 }} 
                                        animationDuration={1500} 
                                    />
                                )}
                                {chartSeries.cumulativeNet && (
                                    <Line 
                                        type="monotone" 
                                        dataKey="cumulativeNet" 
                                        name="Cumulative Net Cash Flow" 
                                        stroke="#3B82F6" 
                                        strokeWidth={4} 
                                        dot={{ r: 5, strokeWidth: 2, fill: isDark ? '#1e293b' : '#ffffff' }} 
                                        activeDot={{ r: 8, stroke: '#3B82F6', strokeWidth: 2 }} 
                                        animationDuration={1500} 
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 30-Day Expense Breakdown Analyzer */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Last 30 Days Expense Breakdown</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Analyze spending over the past 30 days compared to the previous 30 days</p>
                        </div>
                    </div>
                </div>

                {categoryComparison.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Side: Donut Chart & Category Totals */}
                        <div className="space-y-6">
                            <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-950/30 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-4">
                                <div>
                                    <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Spent (30 Days)</span>
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                        {format(addDays(currentPeriodStart, 1), 'MMM dd')} - {format(currentPeriodEnd, 'MMM dd, yyyy')}
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 block mt-1">
                                        vs. {format(addDays(prevPeriodStart, 1), 'MMM dd')} - {format(currentPeriodStart, 'MMM dd, yyyy')}
                                    </span>
                                </div>
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-455">₹{currentTotalSpent.toFixed(2)}</span>
                                    {showOverallTrend && (
                                        <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${
                                            overallDiff <= 0 
                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                                        }`}>
                                            {overallDiff > 0 ? <TrendingUp size={10} /> : overallDiff < 0 ? <TrendingDown size={10} /> : <div className="w-1 h-1 rounded-full bg-gray-400" />}
                                            {overallDiff > 0 ? '+' : overallDiff < 0 ? '-' : ''}{Math.abs(overallDiff).toFixed(1)}% {overallDiff > 0 ? 'Rose' : overallDiff < 0 ? 'Dropped' : 'Stable'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <div className="h-48 w-48 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={donutData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {donutData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                formatter={(value) => `₹${value.toFixed(2)}`}
                                                contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000', fontWeight: 'bold' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                
                                <div className="flex-1 w-full space-y-3">
                                    {categoryComparison.map((cat, idx) => {
                                        const percentage = currentTotalSpent > 0 ? (cat.amount / currentTotalSpent) * 100 : 0;
                                        return (
                                            <div key={idx} className="relative">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{cat.name}</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        ₹{cat.amount.toFixed(2)}
                                                        <span className="text-gray-400">({percentage.toFixed(0)}%)</span>
                                                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1 py-0.2 rounded font-bold ${
                                                            cat.isNew ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' :
                                                            cat.diff <= 0 
                                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                                                        }`}>
                                                            {cat.isNew ? 'New' : (
                                                                <>
                                                                    {cat.diff > 0 ? '+' : cat.diff < 0 ? '-' : ''}
                                                                    {Math.abs(cat.diff).toFixed(0)}%
                                                                </>
                                                            )}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1">
                                                    <div className="h-1 rounded-full" style={{ width: `${percentage}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Transactions List */}
                        <div className="bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-100 dark:border-slate-800 p-5 flex flex-col h-[350px]">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <Search size={16} className="text-gray-400" /> Transactions Log (30 Days)
                            </h3>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                {periodTransactions.map(tx => (
                                    <div key={tx._id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm flex justify-between items-center hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{tx.description || tx.category}</span>
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                                                {format(new Date(tx.date), 'MMM dd')} • {tx.category} • {tx.paymentMethodName || 'Unspecified'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0 pl-3">
                                            <span className="text-sm font-bold text-rose-600 dark:text-rose-455">-₹{tx.amount.toFixed(2)}</span>
                                            {tx.isGroupExpense && <span className="text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 px-1.5 py-0.5 rounded mt-1 font-bold">Group</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-gray-50/20 dark:bg-slate-900/20 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
                            <Calendar size={28} className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <p className="font-bold text-lg text-gray-600 dark:text-gray-300">No expenses in the last 30 days</p>
                    </div>
                )}
            </div>

            {/* Treemap Chart */}
            <div className="glass-card p-8 rounded-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                            <Grid size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Category Distribution (Filtered)</h2>
                    </div>
                </div>

                <div className="h-96 w-full flex justify-center">
                    {pieData && pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                                width={400}
                                height={200}
                                data={pieData}
                                dataKey="size"
                                aspectRatio={4 / 3}
                                stroke={isDark ? '#1e293b' : '#fff'}
                                fill="#8884d8"
                                content={<CustomizedContent />}
                            >
                                <Tooltip
                                    formatter={(value, name) => [`₹${value.toFixed(2)}`, name]}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                        color: isDark ? '#f8fafc' : '#1e293b'
                                    }}
                                />
                            </Treemap>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <Grid size={48} className="mb-4 opacity-20" />
                            <p>No data matches the current filters</p>
                        </div>
                    )}
                </div>
                <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Size represents transaction amount. Grouped by Type.
                </div>
            </div>

            {/* HISTORY SECTION (Filters & Table) */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                            <Filter size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Detailed Transaction History</h2>
                    </div>
                    {filteredTransactions.length > 0 && (
                        <button
                            onClick={downloadCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition-colors font-semibold cursor-pointer"
                            title="Download filtered transactions as CSV"
                        >
                            <Download size={18} />
                            <span className="hidden sm:inline">Download CSV</span>
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="glass-card p-6 rounded-2xl space-y-4 relative z-20">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select
                                className="px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-200 outline-none transition-all min-w-[160px]"
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
                            <div className="relative z-50 min-w-[300px]">
                                <CategoryDropdown
                                    categories={categories.filter(c => typeFilter === 'all' || c.type === typeFilter)}
                                    value={categoryFilter}
                                    onChange={setCategoryFilter}
                                    type={typeFilter}
                                    recents={recentCategories} // Pass True LRU
                                    placeholder="All Categories"
                                    showAllOption={true}
                                    allowFavoriteToggle={false}
                                />
                            </div>
                            <select
                                className="px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-200 outline-none transition-all min-w-[160px]"
                                value={paymentMethodFilter}
                                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                            >
                                <option value="all">All Payment Methods</option>
                                {paymentMethods.map(pm => (
                                    <option key={pm._id} value={pm.name}>{pm.name}</option>
                                ))}
                            </select>
                            <select
                                className="px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-200 outline-none transition-all min-w-[160px]"
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                            >
                                <option value="all">All (Personal + Groups)</option>
                                <option value="personal">Personal Only</option>
                                {groups.map(grp => (
                                    <option key={grp._id} value={grp._id}>{grp.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800/80">
                        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800">
                                <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
                                <input
                                    type="date"
                                    className="bg-transparent outline-none text-sm text-gray-600 dark:text-gray-300"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                />
                                <span className="text-gray-400 dark:text-gray-600">-</span>
                                <input
                                    type="date"
                                    className="bg-transparent outline-none text-sm text-gray-600 dark:text-gray-300"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 max-w-[90vw] md:max-w-none">
                                <button onClick={() => setQuickFilter('month')} className="px-3 py-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/80 transition-colors cursor-pointer">Past Month</button>
                                <button onClick={() => setQuickFilter('ongoing')} className="px-3 py-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/80 transition-colors cursor-pointer">Ongoing Month</button>
                                <button onClick={() => setQuickFilter('quarter')} className="px-3 py-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/80 transition-colors cursor-pointer">Past Quarter</button>
                                <button onClick={() => setQuickFilter('year')} className="px-3 py-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/80 transition-colors cursor-pointer">Past Year</button>
                            </div>

                            {(searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' || paymentMethodFilter !== 'all' || groupFilter !== 'all' || dateRange.start || dateRange.end) && (
                                <button
                                    onClick={clearFilters}
                                    className="text-sm text-rose-500 hover:text-rose-700 font-medium px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm font-medium whitespace-nowrap">
                            <div className="text-gray-500 dark:text-gray-400">
                                Showing {filteredTransactions.length} transactions
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-lg text-indigo-700 dark:text-indigo-400">
                                Selected Total: <span className="font-bold">
                                    ₹{filteredTransactions.filter(tx => selectedTxIds.includes(tx._id)).reduce((acc, tx) => {
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
                            <thead className="bg-gray-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm border-b border-gray-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-left">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={filteredTransactions.length > 0 && selectedTxIds.length === filteredTransactions.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedTxIds(filteredTransactions.map(tx => tx._id));
                                                } else {
                                                    setSelectedTxIds([]);
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-full">
                                                    <Filter size={32} />
                                                </div>
                                                <p>No transactions match your filters.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((tx) => (
                                        <tr key={tx._id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition duration-200">
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    checked={selectedTxIds.includes(tx._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedTxIds([...selectedTxIds, tx._id]);
                                                        } else {
                                                            setSelectedTxIds(selectedTxIds.filter(id => id !== tx._id));
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
                                                    {format(new Date(tx.date), 'MMM dd, yyyy')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {tx.type === 'income' && (
                                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase">
                                                        <ArrowUp size={14} /> Income
                                                    </span>
                                                )}
                                                {tx.type === 'expense' && (
                                                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase">
                                                        <ArrowDown size={14} /> Expense
                                                    </span>
                                                )}
                                                {tx.type === 'investment' && (
                                                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase">
                                                        <DollarSign size={14} /> {tx.investmentType === 'buy' ? 'Invest (Buy)' : 'Invest (Sell)'}
                                                    </span>
                                                )}
                                                {tx.type === 'lend' && (
                                                    <span className="flex items-center gap-1 text-pink-600 dark:text-pink-400 text-xs font-bold uppercase">
                                                        <TrendingUp size={14} className="rotate-45" /> Lend
                                                    </span>
                                                )}
                                                {tx.type === 'borrow' && (
                                                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase">
                                                        <TrendingDown size={14} className="rotate-45" /> Borrow
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 text-xs font-medium rounded-full border ${
                                                    tx.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100/20' :
                                                    tx.type === 'investment' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100/20' :
                                                    tx.type === 'lend' ? 'bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border-pink-100/20' :
                                                    tx.type === 'borrow' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-100/20' :
                                                    'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100/20'
                                                }`}>
                                                    {tx.type === 'lend' ? 'Debt' :
                                                        tx.type === 'borrow' ? 'Debt' :
                                                            tx.category || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200 font-medium">
                                                {tx.description || '-'}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' :
                                                tx.type === 'investment' ? 'text-amber-600 dark:text-amber-400' :
                                                    tx.type === 'lend' ? 'text-pink-600' :
                                                        tx.type === 'borrow' ? 'text-blue-600' :
                                                            'text-rose-600'
                                                }`}>
                                                {tx.type === 'income' || (tx.type === 'investment' && tx.investmentType === 'sell') ? '+' : '-'}₹{tx.amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleDelete(tx._id)}
                                                    className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all font-semibold"
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
        </div>
    );
};

// Treemap Custom Content Component
const CustomizedContent = (props) => {
    const { depth, x, y, width, height, name, value } = props;

    return (
        <g>
            {depth === 1 ? (
                // Top Level Group (Type) - Transparent container
                <g></g>
            ) : (
                // Leaf Node (Category)
                <g>
                    <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        style={{
                            fill: props.fill || '#6366F1', // Use fill passed from data
                            fillOpacity: 1,
                            stroke: '#fff',
                            strokeWidth: 2,
                            // Add subtle transition for hover effects
                            transition: 'all 0.3s'
                        }}
                        rx={6}
                        ry={6}
                    />
                    {/* Text Logic: Show only if box is big enough */}
                    {width > 36 && height > 20 && (
                        <text
                            x={x + width / 2}
                            // Shift up if showing price, otherwise center
                            y={y + height / 2 - (height > 50 && width > 60 ? 8 : 0)}
                            textAnchor="middle"
                            fill="#fff"
                            // Responsive font size
                            fontSize={Math.max(10, Math.min(width / (name.length * 0.75), 16))}
                            fontWeight="700"
                            dominantBaseline="central"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)', pointerEvents: 'none' }}
                        >
                            {name}
                        </text>
                    )}
                    {/* Price Logic: Show only if box is quite large */}
                    {width > 60 && height > 50 && (
                        <text
                            x={x + width / 2}
                            y={y + height / 2 + 12}
                            textAnchor="middle"
                            fill="#ffffff"
                            fillOpacity={0.95}
                            fontSize={11}
                            fontWeight="500"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)', pointerEvents: 'none' }}
                        >
                            ₹{value.toLocaleString()}
                        </text>
                    )}
                </g>
            )}
        </g>
    );
};

export default Analysis;
