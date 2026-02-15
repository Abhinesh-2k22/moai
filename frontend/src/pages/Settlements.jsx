import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const Settlements = () => {
    const { user } = useContext(AuthContext);
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('settle'); // 'settle' (I owe) or 'expect' (Owed to me)
    const [expandedUsers, setExpandedUsers] = useState({});

    useEffect(() => {
        fetchSettlements();
    }, []);

    const fetchSettlements = async () => {
        try {
            const res = await api.get('/settlements');
            setSettlements(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSettleAll = async (otherUserId, name, amount) => {
        if (!window.confirm(`Settle all balances with ${name}? Net amount: ₹${Math.abs(amount).toFixed(2)}`)) return;

        try {
            await api.post('/settlements/settle-all', {
                toUserId: otherUserId,
                userName: name
            });
            setSettlements(settlements.filter(s => s.userId !== otherUserId));
            alert('Settled successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to settle balances');
        }
    };

    const toggleExpand = (userId) => {
        setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    // Filter displayed items
    const displayedSettlements = settlements.filter(s =>
        activeTab === 'settle' ? s.total < 0 : s.total > 0
    );

    const totalAmount = displayedSettlements.reduce((sum, s) => sum + Math.abs(s.total), 0);

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

            {/* Settlements List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                ) : displayedSettlements.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                        <CheckCircle size={48} className="mx-auto mb-3 opacity-20" />
                        <p>All settled up! Nothing to show here.</p>
                    </div>
                ) : (
                    displayedSettlements.map(item => (
                        <div key={item.userId || item.name} className="glass-card rounded-xl overflow-hidden group hover:shadow-md transition-all">
                            {/* Header */}
                            <div className="p-5 flex items-center justify-between cursor-pointer bg-white" onClick={() => toggleExpand(item.userId)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${activeTab === 'settle' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                        }`}>
                                        {activeTab === 'settle' ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
                                        <p className="text-xs text-gray-400 font-medium">Click to see breakdown</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className={`text-xl font-bold ${activeTab === 'settle' ? 'text-rose-600' : 'text-emerald-600'
                                            }`}>
                                            ₹{Math.abs(item.total).toFixed(2)}
                                        </p>
                                    </div>

                                    {/* Stop propagation to avoid toggling when clicking action */}
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleSettleAll(item.userId, item.name, item.total)}
                                            className={`p-3 rounded-full transition-all shadow-sm ${activeTab === 'settle'
                                                ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                                                : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}
                                            title="Settle All"
                                        >
                                            <CheckCircle size={24} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown (Accordion) */}
                            {expandedUsers[item.userId] && (
                                <div className="bg-gray-50/50 border-t border-gray-100 p-4 space-y-2 animate-fade-in">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pl-1">Breakdown</p>
                                    {item.breakdown.map((b, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${b.amount > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                                                <span className="text-sm font-medium text-gray-700">{b.groupName}</span>
                                            </div>
                                            <span className={`text-sm font-bold ${b.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {b.amount > 0 ? '+' : ''}₹{b.amount.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Settlements;
