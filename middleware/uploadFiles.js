const multer = require('multer');

// Setting up storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');  // Ensure this path exists or handle it dynamically
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
    }
});

// Creating multer instance with storage configuration
const upload = multer({ storage: storage });

// Exporting the middleware for handling array of files
module.exports = function (req, res, next) {
    const uploadMultiple = upload.array('files', 5); // Handles up to 5 files
    uploadMultiple(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            return res.status(500).json({ error: err.message });
        } else if (err) {
            // An unknown error occurred when uploading.
            return res.status(500).json({ error: err.message });
        }

        // Everything went fine. Proceed to the next middleware.
        next();
    });
};
