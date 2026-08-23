
const User = require('../models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Helper for simple hashing
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Register User
exports.register = async (req, res) => {
  const { name, email, password, username, securityQuestion, securityAnswer } = req.body;

  try {
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      if (user.email === email) return res.status(400).json({ msg: 'User already exists' });
      if (user.username === username) return res.status(400).json({ msg: 'Username already taken' });
    }

    // Simple SHA-256 hash (Fast, low CPU)
    const hashedPassword = hashPassword(password);

    // Hash the security answer (lowercase + trimmed for consistency)
    const hashedAnswer = securityAnswer
      ? hashPassword(securityAnswer.trim().toLowerCase())
      : undefined;

    user = new User({
      name,
      email,
      username,
      password: hashedPassword,
      securityQuestion: securityQuestion || undefined,
      securityAnswer: hashedAnswer
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
        res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            profilePic: user.profilePic ? { contentType: user.profilePic.contentType } : undefined,
            hasSecurityQuestion: !!user.securityQuestion,
            securityQuestion: user.securityQuestion || null
          }
        });
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
        res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            profilePic: user.profilePic ? { contentType: user.profilePic.contentType } : undefined,
            hasSecurityQuestion: !!user.securityQuestion,
            securityQuestion: user.securityQuestion || null
          }
        });
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

// Forgot Password — returns the user's security question
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

    if (!user.securityQuestion) {
      return res.status(400).json({ msg: 'No security question set for this account. Please log in and set one from Profile Settings.' });
    }

    res.json({ securityQuestion: user.securityQuestion });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Reset Password — verifies security answer then sets new password
exports.resetPassword = async (req, res) => {
  const { identifier, securityAnswer, newPassword } = req.body;

  if (!identifier || !securityAnswer || !newPassword) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) {
      return res.status(404).json({ msg: 'User does not exist' });
    }

    if (!user.securityQuestion || !user.securityAnswer) {
      return res.status(400).json({ msg: 'No security question set for this account' });
    }

    // Hash the provided answer and compare
    const hashedAnswer = hashPassword(securityAnswer.trim().toLowerCase());
    if (hashedAnswer !== user.securityAnswer) {
      return res.status(400).json({ msg: 'Incorrect answer. Please try again.' });
    }

    // Hash the new password and save
    user.password = hashPassword(newPassword);
    await user.save();

    res.json({ msg: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Set / Update Security Question (protected — requires login)
exports.setSecurityQuestion = async (req, res) => {
  const { securityQuestion, securityAnswer } = req.body;

  if (!securityQuestion || !securityAnswer) {
    return res.status(400).json({ msg: 'Please provide both a security question and answer' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.securityQuestion = securityQuestion.trim();
    user.securityAnswer = hashPassword(securityAnswer.trim().toLowerCase());
    await user.save();

    res.json({ msg: 'Security question updated successfully', hasSecurityQuestion: true, securityQuestion: user.securityQuestion });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Change Password (protected — requires login, verified by security answer)
exports.changePassword = async (req, res) => {
  const { securityAnswer, newPassword } = req.body;

  if (!securityAnswer || !newPassword) {
    return res.status(400).json({ msg: 'Please provide your security answer and a new password' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!user.securityQuestion || !user.securityAnswer) {
      return res.status(400).json({ msg: 'No security question set for this account. Please set one first.' });
    }

    // Verify the security answer
    const hashedAnswer = hashPassword(securityAnswer.trim().toLowerCase());
    if (hashedAnswer !== user.securityAnswer) {
      return res.status(400).json({ msg: 'Incorrect security answer. Please try again.' });
    }

    // Hash and save new password
    user.password = hashPassword(newPassword);
    await user.save();

    res.json({ msg: 'Password changed successfully.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
