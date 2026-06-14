const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        unique: true,
        sparse: true // Allows null/undefined for existing users
    },
    password: {
        type: String,
        required: true
    },
    profilePic: {
        data: {
            type: Buffer,
            select: false
        },
        contentType: String
    },
    resetOtp: {
        type: String
    },
    resetOtpExpires: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);
