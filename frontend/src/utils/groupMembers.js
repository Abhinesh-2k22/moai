export const getMemberId = (member) => {
    if (member.userId) return member.userId._id || member.userId;
    return `guest:${member.guestName}`;
};

export const getMemberLabel = (member, currentUserId) => {
    if (member.userId) {
        return member.userId.name || 'Unknown';
    }
    const name = member.dummyUserId?.name || member.guestName || 'Guest';
    const addedById = member.addedBy?._id || member.addedBy;
    if (member.dummyUserId && addedById && addedById.toString() !== currentUserId?.toString()) {
        const ownerName = member.addedBy?.name || 'Someone';
        return `${name} (${ownerName}'s contact)`;
    }
    if (member.dummyUserId) return name;
    return `${name} (Guest)`;
};

export const getMemberInitial = (member) => {
    const label = member.userId?.name || member.dummyUserId?.name || member.guestName || '?';
    return label.charAt(0);
};
