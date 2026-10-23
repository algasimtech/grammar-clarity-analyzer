const express = require("express");
require("dotenv").config();

const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Allow the server to receive JSON data
app.use(express.json());

// Serve HTML, CSS, and JavaScript files
app.use(express.static(path.join(__dirname, "public")));


app.post("/api/analyze", (req, res) => {
    const { text } = req.body || {};

    // Check that the user provided valid text
    if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({
            error: "Please enter a sentence or paragraph."
        });
    }

    // Temporary analysis response
    const analysis = {
        grammarScore: 45,
        clarityScore: 82,
        grammarErrors: [
            "Use 'doesn't' instead of 'don't'.",
            "Use 'explain' instead of 'explains'."
        ],
        clarityImprovements: [
            "Improve the verb forms for better readability."
        ],
        improvedText: "He doesn't know how to explain the problem properly."
    };

    res.json(analysis);
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
