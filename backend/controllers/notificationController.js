const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');

// Get all notifications for the logged-in user
exports.getNotifications = async (req, res) => {
    try {
        // Auto-cleanup: Delete notifications older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        await Notification.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });

        const notifications = await Notification.find({
            userId: req.user.id,
            status: 'pending'
        })
            .populate('fromUserId', 'name email')
            .populate('transactionId')
            .sort({ createdAt: -1 });

        res.json(notifications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create a new notification (for settlement requests, reminders, etc.)
exports.createNotification = async (req, res) => {
    try {
        const { recipientUserId, type, amount, description, transactionId } = req.body;

        const notification = new Notification({
            userId: recipientUserId, // The person receiving the notification
            fromUserId: req.user.id, // The person sending it
            type,
            amount,
            description,
            transactionId,
            status: 'pending'
        });

        await notification.save();
        res.json(notification);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Confirm a lend/borrow transaction
exports.confirmTransaction = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (notification.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Get the original transaction
        const originalTx = await Transaction.findById(notification.transactionId);

        if (!originalTx) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // Handle Settlement Confirmation
        if (notification.type === 'settle_request') {
            // 1. Mark original transaction as settled
            originalTx.isSettled = true;
            originalTx.settlementStatus = 'confirmed';
            await originalTx.save();

            // 2. Mark the linked transaction (for the other user) as settled too
            if (originalTx.linkedTransactionId) {
                const linkedTx = await Transaction.findById(originalTx.linkedTransactionId);
                if (linkedTx) {
                    linkedTx.isSettled = true;
                    linkedTx.settlementStatus = 'confirmed';
                    await linkedTx.save();
                }
            }

            // 3. Create Repayment Transactions to update balances
            // Lender gets Money IN (Income), Borrower gets Money OUT (Expense)

            let lenderId, borrowerId;
            if (originalTx.type === 'lend') {
                lenderId = originalTx.userId;
                borrowerId = originalTx.recipientUserId;
            } else { // borrow
                lenderId = originalTx.recipientUserId;
                borrowerId = originalTx.userId;
            }

            // Transaction for Lender (Income)
            const lenderRepayment = new Transaction({
                userId: lenderId,
                amount: originalTx.amount,
                type: 'income',
                category: 'Debt Repayment',
                description: `Settlement for: ${originalTx.description || 'Loan'}`,
                date: new Date(),
                status: 'confirmed'
            });

            // Transaction for Borrower (Expense)
            const borrowerRepayment = new Transaction({
                userId: borrowerId,
                amount: originalTx.amount,
                type: 'expense',
                category: 'Debt Repayment',
                description: `Settlement for: ${originalTx.description || 'Loan'}`,
                date: new Date(),
                status: 'confirmed'
            });

            await lenderRepayment.save();
            await borrowerRepayment.save();
        }
        // Handle Lend/Borrow Confirmation (Existing Logic)
        else {
            // Update original transaction status
            originalTx.status = 'confirmed';
            await originalTx.save();

            // Create reciprocal transaction
            const reciprocalType = originalTx.type === 'lend' ? 'borrow' : 'lend';
            const reciprocalTx = new Transaction({
                userId: req.user.id,
                amount: originalTx.amount,
                type: reciprocalType,
                description: originalTx.description,
                date: originalTx.date,
                recipientUserId: originalTx.userId,
                status: 'confirmed',
                linkedTransactionId: originalTx._id
            });

            await reciprocalTx.save();

            // Link the original transaction to the reciprocal one
            originalTx.linkedTransactionId = reciprocalTx._id;
            await originalTx.save();
        }

        // Update notification status
        notification.status = 'confirmed';
        await notification.save();

        res.json({ message: 'Transaction confirmed successfully', transaction: originalTx });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Reject a lend/borrow transaction
exports.rejectTransaction = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (notification.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // If it was a lend/borrow request, reject the original transaction
        if (notification.type === 'lend_request' || notification.type === 'borrow_request') {
            await Transaction.findByIdAndUpdate(notification.transactionId, {
                status: 'rejected'
            });
        }
        // If it was a settlement request, reset the settlement status
        else if (notification.type === 'settle_request') {
            const transaction = await Transaction.findById(notification.transactionId);
            if (transaction) {
                transaction.settlementStatus = 'none'; // Reset logic could be more complex if needed
                await transaction.save();
            }
        }

        // Update notification status
        notification.status = 'rejected';
        await notification.save();

        res.json({ message: 'Transaction rejected successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
