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

  if (notification.hidden) return;

  notification.classList.add("exiting");

  setTimeout(() => {
    if (notification.classList.contains("exiting")) {
      notification.hidden = true;
      notification.textContent = "";
      notification.classList.remove("exiting");
    }
  }, 250);
}

const wordCount = document.getElementById("wordCount");
const characterCount = document.getElementById("characterCount");
const sentenceCount = document.getElementById("sentenceCount");
const readingTime = document.getElementById("readingTime");

function updateTextStatistics() {
  const text = userText.value;
  const trimmedText = text.trim();

  const words = trimmedText ? trimmedText.split(/\s+/).length : 0;

  const characters = text.length;

  const sentences = trimmedText
    ? (trimmedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).filter((sentence) =>
        sentence.trim(),
      ).length
    : 0;

  const seconds = Math.ceil((words / 200) * 60);

  wordCount.textContent = words;
  characterCount.textContent = characters;
  sentenceCount.textContent = sentences;
  readingTime.textContent = `${seconds} sec`;
}

userText.addEventListener("input", updateTextStatistics);
updateTextStatistics();

// Display the analysis results
function renderFeedback(container, items, emptyMessage) {
  container.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "feedback-empty";
    li.textContent = emptyMessage;
    container.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "feedback-card";

    const comparison = document.createElement("div");
    comparison.className = "feedback-comparison";

    const original = document.createElement("span");
    original.className = "feedback-original";
    original.textContent = item.original;

    const arrow = document.createElement("span");
    arrow.className = "feedback-arrow";
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");

    const suggestion = document.createElement("span");
    suggestion.className = "feedback-suggestion";
    suggestion.textContent = item.suggestion;

    comparison.appendChild(original);
    comparison.appendChild(arrow);
    comparison.appendChild(suggestion);

    const explanation = document.createElement("p");
    explanation.className = "feedback-explanation";
    explanation.textContent = item.explanation;

    li.appendChild(comparison);
    li.appendChild(explanation);

    container.appendChild(li);
  });
}

function displayResults(data) {
  grammarScore.textContent = `${data.grammarScore}%`;
  clarityScore.textContent = `${data.clarityScore}%`;

  grammarProgress.value = data.grammarScore;
  clarityProgress.value = data.clarityScore;

  renderFeedback(grammarErrors, data.grammarErrors, "No grammar errors found.");

  renderFeedback(
    clarityImprovements,
    data.clarityImprovements,
    "Your writing is already clear.",
  );

  improvedText.textContent = data.improvedText;

  results.hidden = false;

  requestAnimationFrame(() => {
    results.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
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
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      showNotification("The analysis is taking too long. Please try again.");
    } else {
      showNotification(error.message);
    }
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
    showNotification("Improved text copied successfully!", "success");
    copyBtn.textContent = "Copied!";

    setTimeout(() => {
      copyBtn.textContent = "Copy Improved Text";
    }, 2000);
  } catch (error) {
    showNotification("Unable to copy text. Please copy it manually.");
  }
});

// themes

const themeOptions = document.querySelectorAll(".theme-option");
const validThemes = ["light", "dark", "sepia"];

function applyTheme(theme) {
  if (!validThemes.includes(theme)) {
    return;
  }

  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  themeOptions.forEach((button) => {
    const isSelected = button.dataset.themeValue === theme;
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

const savedTheme = localStorage.getItem("theme");
applyTheme(validThemes.includes(savedTheme) ? savedTheme : "light");

themeOptions.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeValue);
  });
});
