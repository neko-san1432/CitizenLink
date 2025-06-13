const express = require('express');
const app = express();
const path = require('path');

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Handle all routes by sending the requested file or index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, req.path));
});

// Start the server
const PORT = 5500;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
