import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Link } from 'react-router-dom';
import { Plus, Users, ArrowRight, FolderOpen, Lock } from 'lucide-react';

const Groups = () => {
    const [groups, setGroups] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await api.get('/groups');
            setGroups(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            await api.post('/groups', { name: newGroupName });
            setNewGroupName('');
            setIsCreating(false);
            fetchGroups();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Groups</h1>
                    <p className="text-gray-500 mt-1">Manage shared expenses with friends & family</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-1"
                >
                    <Plus size={20} />
                    Create Group
                </button>
            </div>

            {isCreating && (
                <div className="glass-card p-6 rounded-2xl animate-slide-up">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">Create New Group</h3>
                    <form onSubmit={handleCreateGroup} className="flex gap-4">
                        <input
                            type="text"
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Enter group name (e.g. 'Summer Trip')"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            required
                        />
                        <button
                            type="submit"
                            className="bg-emerald-600 text-white px-8 py-3 rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-lg hover:shadow-emerald-500/30"
                        >
                            Create
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsCreating(false)}
                            className="bg-gray-100 text-gray-700 px-8 py-3 rounded-xl hover:bg-gray-200 transition-all font-medium"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group) => (
                    <Link
                        key={group._id}
                        to={`/groups/${group._id}`}
                        className="glass-card p-6 rounded-2xl hover:shadow-card-hover transition-all duration-300 group relative overflow-hidden border border-white/60"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Users size={80} className="text-indigo-600" />
                        </div>

                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                <Users size={24} />
                            </div>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 ${group.status === 'open'
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}>
                                {group.status === 'open' ? <FolderOpen size={12} /> : <Lock size={12} />}
                                {group.status.toUpperCase()}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">{group.name}</h3>
                        <p className="text-gray-500 text-sm mb-6 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                            {group.members.length} Members
                        </p>

                        <div className="flex items-center text-indigo-600 font-bold text-sm group-hover:gap-2 transition-all">
                            View Details <ArrowRight size={16} className="ml-1" />
                        </div>
                    </Link>
                ))}

                {groups.length === 0 && !isCreating && (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-white rounded-full shadow-sm">
                                <Users size={32} className="text-gray-300" />
                            </div>
                            <p>No groups yet. Create one to start sharing expenses!</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Groups;
