
const userText = document.getElementById("userText");
const analyzeBtn = document.getElementById("analyzeBtn");
const results = document.getElementById("results");

const grammarScore = document.getElementById("grammarScore");
const clarityScore = document.getElementById("clarityScore");

const grammarProgress = document.getElementById("grammarProgress");
const clarityProgress = document.getElementById("clarityProgress");

const grammarErrors = document.getElementById("grammarErrors");
const clarityImprovements = document.getElementById("clarityImprovements");

const improvedText = document.getElementById("improvedText");
const copyBtn = document.getElementById("copyBtn");

// Display the analysis results
function displayResults(data) {
    grammarScore.textContent = `${data.grammarScore}%`;
    clarityScore.textContent = `${data.clarityScore}%`;

    grammarProgress.value = data.grammarScore;
    clarityProgress.value = data.clarityScore;

    grammarErrors.innerHTML = "";
    clarityImprovements.innerHTML = "";

    if (data.grammarErrors.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No grammar errors found.";
        grammarErrors.appendChild(li);
    } else {
        data.grammarErrors.forEach(error => {
            const li = document.createElement("li");
            li.textContent = error;
            grammarErrors.appendChild(li);
        });
    }

    if (data.clarityImprovements.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Your writing is clear.";
        clarityImprovements.appendChild(li);
    } else {
        data.clarityImprovements.forEach(improvement => {
            const li = document.createElement("li");
            li.textContent = improvement;
            clarityImprovements.appendChild(li);
        });
    }

    improvedText.textContent = data.improvedText;
    results.hidden = false;
}

// Handle analyze button click

analyzeBtn.addEventListener("click", async () => {
    const text = userText.value.trim();

    // Check whether the user entered text
    if (!text) {
        alert("Please enter a sentence or paragraph.");
        return;
    }

    // Show loading state
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing...";
    results.hidden = true;

    try {
        // Send the text to our Express backend
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text })
        });

        // Convert the backend response to JSON
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Analysis failed.");
        }

        // Display the returned analysis
        displayResults(data);

    } catch (error) {
        alert(error.message);
    } finally {
        // Restore the button
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "Analyze Text";
    }
});


// Copy the improved text
copyBtn.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(improvedText.textContent);
        copyBtn.textContent = "Copied!";

        setTimeout(() => {
            copyBtn.textContent = "Copy Improved Text";
        }, 2000);
    } catch (error) {
        alert("Unable to copy text. Please copy it manually.");
    }
});
