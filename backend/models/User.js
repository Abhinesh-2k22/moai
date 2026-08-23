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
    securityQuestion: {
        type: String
    },
    securityAnswer: {
        type: String // Stored as SHA-256 hash
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);
