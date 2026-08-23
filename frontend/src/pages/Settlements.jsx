import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import ConfirmSettlementModal from '../components/ConfirmSettlementModal';

const Settlements = () => {
    const { user } = useContext(AuthContext);
    const [settlements, setSettlements] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('settle'); // 'settle' or 'expect'
    const [expandedUsers, setExpandedUsers] = useState({});

    // Settle Modal State
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [settleData, setSettleData] = useState(null);
    const [settlePaymentMethodId, setSettlePaymentMethodId] = useState('');
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        fetchSettlements();
        fetchPaymentMethods();
    }, []);

    const fetchPaymentMethods = async () => {
        try {
            const res = await api.get('/payment-methods/ensure-defaults');
            setPaymentMethods(res.data);
            const unspecified = res.data.find(m => m.name === 'Unspecified');
            if (unspecified) setSettlePaymentMethodId(unspecified._id);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSettlements = async () => {
        try {
            const [settlementsRes, historyRes] = await Promise.all([
                api.get('/settlements'),
                api.get('/settlements/history')
            ]);
            setSettlements(settlementsRes.data);

            // unkowing deleted document in settlement collection so to revert it i have inserted docs
            const excludedIds = [
                '6a2e88d0a880835fe6a7553d',
                '6a2e88e2a880835fe6a7553f',
                '6a2e8a0da880835fe6a75541'
            ];
            const filteredHistory = historyRes.data.filter(item => !excludedIds.includes(item._id));
            setHistory(filteredHistory);

            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const openSettleModal = (item) => {
        setSettleData(item);
        setIsSettleModalOpen(true);
    };

    const handleConfirmSettle = async () => {
        if (!settleData) return;
        setModalLoading(true);

        const pm = paymentMethods.find(m => m._id === settlePaymentMethodId);
        const paymentMethodName = pm ? pm.name : 'Unspecified';

        try {
            if (settleData.dummyId) {
                // Personal dummy settling — settle all transactions first
                const personalEntries = settleData.breakdown.filter(b => b.type === 'personal' && b.transactionIds);
                for (const entry of personalEntries) {
                    for (const txId of entry.transactionIds) {
                        await api.put(`/transactions/${txId}/settle`, {
                            paymentMethodId: settlePaymentMethodId || undefined,
                            paymentMethodName
                        });
                    }
                }

                // Create ONE consolidated Settlement record for history
                const iOwe = settleData.total < 0; // negative = I owe the contact
                await api.post('/settlements', {
                    type: 'personal',
                    fromGuestName: iOwe ? user?.name : settleData.name,
                    toGuestName: iOwe ? settleData.name : user?.name,
                    amount: Math.abs(settleData.total),
                    paymentMethodId: settlePaymentMethodId || undefined,
                    confirmed: true
                });

                fetchSettlements();
                setIsSettleModalOpen(false);
                setSettleData(null);
            } else {
                // User-to-user settling — settle-all creates one Settlement record internally
                await api.post('/settlements/settle-all', {
                    toUserId: settleData.userId,
                    userName: settleData.name,
                    paymentMethodId: settlePaymentMethodId || undefined,
                    paymentMethodName
                });
                fetchSettlements();
                setIsSettleModalOpen(false);
                setSettleData(null);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to settle');
        } finally {
            setModalLoading(false);
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
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Settlements</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your debts and receivables</p>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 dark:bg-slate-900 rounded-xl w-full max-w-2xl overflow-x-auto">
                <button
                    onClick={() => setActiveTab('settle')}
                    className={`flex-1 py-3 px-4 min-w-[120px] rounded-lg font-bold text-sm transition-all cursor-pointer ${activeTab === 'settle'
                        ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
                        }`}
                >
                    To Settle
                </button>
                <button
                    onClick={() => setActiveTab('expect')}
                    className={`flex-1 py-3 px-4 min-w-[120px] rounded-lg font-bold text-sm transition-all cursor-pointer ${activeTab === 'expect'
                        ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
                        }`}
                >
                    To Expect
                </button>
            </div>

            {/* Total Card */}
            <div className={`glass-card p-8 rounded-2xl text-center border ${activeTab === 'settle' ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30' : 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30'
                }`}>
                <p className="text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide text-xs mb-2">
                    Total Amount {activeTab === 'settle' ? 'You Owe' : 'Owed to You'}
                </p>
                <h2 className={`text-4xl font-bold ${activeTab === 'settle' ? 'text-rose-600 dark:text-rose-455' : 'text-emerald-600 dark:text-emerald-455'
                    }`}>
                    ₹{totalAmount.toFixed(2)}
                </h2>
            </div>

            {/* Settlements List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading...</div>
                ) : (
                    <>
                        {displayedSettlements.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50/20 dark:bg-slate-900/20 rounded-2xl border border-gray-100 dark:border-slate-800 border-dashed">
                                <CheckCircle size={48} className="mx-auto mb-3 opacity-20" />
                                <p>All settled up! Nothing to show here.</p>
                            </div>
                        ) : (
                            displayedSettlements.map(item => {
                                const itemKey = item.userId || item.dummyId || item.name;
                                return (
                                    <div key={itemKey} className="glass-card rounded-xl overflow-hidden group hover:shadow-md transition-all">
                                        <div className="p-5 flex items-center justify-between cursor-pointer bg-white dark:bg-slate-900/40" onClick={() => toggleExpand(itemKey)}>
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-full ${activeTab === 'settle' ? 'bg-rose-100 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                    {activeTab === 'settle' ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">{item.name}</h3>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Click to see breakdown</p>
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
                                                        onClick={() => openSettleModal(item)}
                                                        className={`p-3 rounded-full transition-all shadow-sm cursor-pointer ${activeTab === 'settle'
                                                            ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-950/70'
                                                            : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-950/70'}`}
                                                        title="Settle All"
                                                    >
                                                        <CheckCircle size={24} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Breakdown (Accordion) */}
                                        {expandedUsers[itemKey] && (
                                            <div className="bg-gray-50/50 dark:bg-slate-950/30 border-t border-gray-100 dark:border-slate-800 p-4 space-y-2 animate-fade-in">
                                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 pl-1">Breakdown</p>
                                                {item.breakdown.map((b, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900/40 p-3 rounded-lg border border-gray-100 dark:border-slate-800 shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${b.amount > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{b.groupName}</span>
                                                        </div>
                                                        <span className={`text-sm font-bold ${b.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {b.amount > 0 ? '+' : ''}₹{b.amount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}

                        <div className="mt-12 mb-4 pt-8 border-t border-gray-200 dark:border-slate-800">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <Clock size={20} className="text-gray-400" />
                                {activeTab === 'settle' ? 'Debts You Paid' : 'Debts Paid To You'}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {(() => {
                                const displayedHistory = history.filter(item => {
                                    const myId = (user?._id || user?.id)?.toString();
                                    const fromUserIdStr = item.fromUserId ? (item.fromUserId._id || item.fromUserId).toString() : null;
                                    const amIPayer = (fromUserIdStr && fromUserIdStr === myId) || (item.fromGuestName === user?.name);
                                    return activeTab === 'settle' ? amIPayer : !amIPayer;
                                });

                                if (displayedHistory.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-gray-400 dark:text-gray-500 bg-gray-50/20 dark:bg-slate-900/20 rounded-2xl border border-gray-100 dark:border-slate-800 border-dashed">
                                            <p>No relevant settlement history found.</p>
                                        </div>
                                    );
                                }

                                return displayedHistory.map(item => {
                                    const myId = (user?._id || user?.id)?.toString();
                                    const fromUserIdStr = item.fromUserId ? (item.fromUserId._id || item.fromUserId).toString() : null;
                                    const amIPayer = (fromUserIdStr && fromUserIdStr === myId) || (item.fromGuestName === user?.name);

                                    const otherPerson = amIPayer ?
                                        (item.toUserId ? item.toUserId.name : item.toGuestName) :
                                        (item.fromUserId ? item.fromUserId.name : item.fromGuestName);

                                    return (
                                        <div key={item._id} className="glass-card rounded-xl overflow-hidden p-5 flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-full ${amIPayer ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'}`}>
                                                    {amIPayer ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">
                                                        {amIPayer ? `You paid ${otherPerson}` : `${otherPerson} paid you`}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
                                                        <Clock size={12} />
                                                        {format(new Date(item.date), 'MMM dd, yyyy • hh:mm a')}
                                                        {item.groupId && (
                                                            <>
                                                                <span className="mx-1">•</span>
                                                                <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{item.groupId.name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xl font-bold ${amIPayer ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {amIPayer ? '+' : '-'}₹{Math.abs(item.amount).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </>
                )}
            </div>

            <ConfirmSettlementModal
                isOpen={isSettleModalOpen && settleData !== null}
                onClose={() => {
                    setIsSettleModalOpen(false);
                    setSettleData(null);
                }}
                onConfirm={handleConfirmSettle}
                title="Settle Up"
                message={`You are about to record a settlement of ₹${Math.abs(settleData?.total || 0).toFixed(2)} with ${settleData?.name}.`}
                amount={settleData?.total || 0}
                paymentMethods={paymentMethods}
                paymentMethodId={settlePaymentMethodId}
                setPaymentMethodId={setSettlePaymentMethodId}
                loading={modalLoading}
            />
        </div>
    );
};

export default Settlements;
