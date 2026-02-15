const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/settlements', require('./routes/settlementRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

app.head('/ping', (req, res) => {
    res.status(200).end();
});

app.get('/', (req, res) => {
    res.send('Money Manager API is running');
});

// Debug Route to check DB Connection
app.get('/api/debug/config', (req, res) => {
    res.json({
        mongoUri: process.env.MONGO_URI ? process.env.MONGO_URI.split('@')[1] : 'Not Set', // Hide credentials
        dbName: mongoose.connection.name,
        host: mongoose.connection.host
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
