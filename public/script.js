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

const notification = document.getElementById("notification");

let notificationTimer;

function showNotification(message, type = "error") {
    clearTimeout(notificationTimer);

    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.hidden = false;

    notificationTimer = setTimeout(() => {
        hideNotification();
    }, 5000);
}

function hideNotification() {
    clearTimeout(notificationTimer);

    notification.hidden = true;
    notification.textContent = "";
}


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
    data.grammarErrors.forEach((error) => {
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
    data.clarityImprovements.forEach((improvement) => {
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
    showNotification("Please enter a sentence or paragraph.");
    return;
  }

  // Show loading state
  hideNotification();
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  results.hidden = true;

  try {
    // Send the text to our Express backend

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(60000),
    });

    // Convert the backend response to JSON
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    // Display the returned analysis
    displayResults(data);
  
  }catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
        showNotification("The analysis is taking too long. Please try again.");
    } else {
        showNotification(error.message);
    }
}finally {
    // Restore the button
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Text";
  }
});

// Copy the improved text
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(improvedText.textContent);
    showNotification("Improved text copied successfully!", "success");
    copyBtn.textContent = "Copied!";

    setTimeout(() => {
      copyBtn.textContent = "Copy Improved Text";
    }, 2000);
  } catch (error) {
    showNotification("Unable to copy text. Please copy it manually.");
  }
});
