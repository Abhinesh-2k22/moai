
const User = require('../models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const emailService = require('../utils/emailService');

// Helper for simple hashing
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Register User
exports.register = async (req, res) => {
  const { name, email, password, username } = req.body;

  try {
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      if (user.email === email) return res.status(400).json({ msg: 'User already exists' });
      if (user.username === username) return res.status(400).json({ msg: 'Username already taken' });
    }

    // Simple SHA-256 hash (Fast, low CPU)
    const hashedPassword = hashPassword(password);

    user = new User({
      name,
      email,
      username,
      password: hashedPassword
    });

    await user.save();

    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '30d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, profilePic: user.profilePic ? { contentType: user.profilePic.contentType } : undefined } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Login User
exports.login = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    let user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const hashedPassword = hashPassword(password);

    if (hashedPassword !== user.password) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '30d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, profilePic: user.profilePic ? { contentType: user.profilePic.contentType } : undefined } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get User (Search)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { identifier } = req.body;

  if (!identifier) {
    return res.status(400).json({ msg: 'Please provide email or username' });
  }

  try {
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) {
      return res.status(404).json({ msg: 'User with this email or username does not exist' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP and expiration (10 minutes)
    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Send OTP
    await emailService.sendOtpEmail(user.email, otp);

    res.json({ msg: 'OTP sent successfully to registered email address' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { identifier, otp, newPassword } = req.body;

  if (!identifier || !otp || !newPassword) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) {
      return res.status(404).json({ msg: 'User does not exist' });
    }

    // Check OTP and expiration
    if (!user.resetOtp || user.resetOtp !== otp || !user.resetOtpExpires || user.resetOtpExpires < Date.now()) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    // Hash the new password
    const hashedPassword = hashPassword(newPassword);

    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.json({ msg: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

