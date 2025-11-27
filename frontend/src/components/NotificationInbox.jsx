import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Check, X, Bell, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

const NotificationInbox = ({ isOpen, onClose, onNotificationUpdate }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await api.get('/notifications');
            setNotifications(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (notificationId) => {
        try {
            await api.post(`/notifications/${notificationId}/confirm`);
            fetchNotifications();
            if (onNotificationUpdate) onNotificationUpdate();
        } catch (err) {
            console.error(err);
            alert('Failed to confirm transaction');
        }
    };

    const handleReject = async (notificationId) => {
        if (!window.confirm('Are you sure you want to reject this request?')) return;
        try {
            await api.post(`/notifications/${notificationId}/reject`);
            fetchNotifications();
            if (onNotificationUpdate) onNotificationUpdate();
        } catch (err) {
            console.error(err);
            alert('Failed to reject transaction');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-2">
                    <Bell size={20} className="text-indigo-600" />
                    <h3 className="font-bold text-gray-800">Notifications</h3>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white rounded-lg transition-colors">
                    <X size={18} className="text-gray-500" />
                </button>
            </div>

            <div className="overflow-y-auto flex-1">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-sm">Loading...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Bell size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No pending notifications</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {notifications.map((notif) => (
                            <div key={notif._id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-full ${notif.type === 'lend_request' ? 'bg-pink-100 text-pink-600' :
                                        notif.type === 'borrow_request' ? 'bg-blue-100 text-blue-600' :
                                            'bg-purple-100 text-purple-600'
                                        }`}>
                                        <User size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800">
                                            {notif.fromUserId?.name || 'Someone'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {notif.type === 'lend_request' && 'wants to lend you'}
                                            {notif.type === 'borrow_request' && 'wants to borrow from you'}
                                            {notif.type === 'settle_request' && 'wants to settle a debt of'}
                                        </p>
                                        <p className="text-lg font-bold text-indigo-600 mt-1">
                                            ₹{notif.amount.toFixed(2)}
                                        </p>
                                        {notif.description && (
                                            <p className="text-xs text-gray-600 mt-1 italic">"{notif.description}"</p>
                                        )}
                                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                                            <Clock size={12} />
                                            {format(new Date(notif.createdAt), 'MMM dd, yyyy')}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                    {notif.type === 'remind' ? (
                                        <button
                                            onClick={() => handleReject(notif._id)} // Reuse reject to delete/dismiss
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                                        >
                                            <Check size={16} />
                                            Got it
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleConfirm(notif._id)}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                                            >
                                                <Check size={16} />
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => handleReject(notif._id)}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-medium"
                                            >
                                                <X size={16} />
                                                Reject
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationInbox;
