const express = require('express');
const router = express.Router();
const { sendMessage, getMessages } = require('../controllers/chatController');
const uploadFiles = require('../middleware/uploadFiles');

// Route to send a message
router.post('/send', sendMessage);

// Route to get messages between two users
router.get('/messages', getMessages);

// Route to upload files
router.post('/uploadFiles', uploadFiles, async (req, res) => {
    const { from, to, message } = req.body;
    if (req.files && req.files['files']) {
        const filePaths = req.files['files'].map(file => file.path);

        try {
            // Save the chat message with file paths to the database
            const chat = new Chat({
                from,
                to,
                message: message || 'File uploaded',
                files: filePaths
            });
            await chat.save();
            res.status(201).json({ message: "Files uploaded successfully", chat });
        } catch (error) {
            res.status(500).json({ message: "Error saving message with files", error: error.message });
        }
    } else {
        res.status(400).json({ message: "No files uploaded" });
    }
});
module.exports = router;
