const userText = document.getElementById("userText");
const analyzeBtn = document.getElementById("analyzeBtn");
const results = document.getElementById("results");

const grammarScore = document.getElementById("grammarScore");
const clarityScore = document.getElementById("clarityScore");
const grammarProgress = document.getElementById("grammarProgress");
const clarityProgress = document.getElementById("clarityProgress");

const grammarErrors = document.getElementById("grammarErrors");
const clarityImprovements = document.getElementById("clarityImprovements");
const inputIssues = document.getElementById("inputIssues");
const inputIssuesSection = document.getElementById("inputIssuesSection");
const inputWarning = document.getElementById("inputWarning");
const inputWarningTitle = document.getElementById("inputWarningTitle");
const inputWarningMessage = document.getElementById("inputWarningMessage");
const writingFeedback = document.getElementById("writingFeedback");
const improvedTextSection = document.getElementById("improvedTextSection");
const improvedTextHeading = document.getElementById("improvedTextHeading");

const improvedText = document.getElementById("improvedText");
const copyBtn = document.getElementById("copyBtn");
const notification = document.getElementById("notification");

const wordCount = document.getElementById("wordCount");
const characterCount = document.getElementById("characterCount");
const sentenceCount = document.getElementById("sentenceCount");
const readingTime = document.getElementById("readingTime");

let notificationTimer;
let notificationExitTimer;
let copyTimer;

function showNotification(message, type = "error") {
  clearTimeout(notificationTimer);
  clearTimeout(notificationExitTimer);
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.hidden = false;
  notificationTimer = setTimeout(hideNotification, 5000);
}

function hideNotification() {
  clearTimeout(notificationTimer);
  clearTimeout(notificationExitTimer);
  if (notification.hidden) return;
  notification.classList.add("exiting");
  notificationExitTimer = setTimeout(() => {
    notification.hidden = true;
    notification.textContent = "";
    notification.classList.remove("exiting");
  }, 250);
}

function updateTextStatistics() {
  const text = userText.value;
  const trimmedText = text.trim();
  const words = trimmedText ? trimmedText.split(/\s+/).length : 0;
  const sentences = trimmedText
    ? (trimmedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
        .filter((sentence) => sentence.trim()).length
    : 0;

  wordCount.textContent = words;
  characterCount.textContent = text.length;
  sentenceCount.textContent = sentences;
  readingTime.textContent = `${Math.ceil((words / 200) * 60)} sec`;
}

userText.addEventListener("input", updateTextStatistics);
updateTextStatistics();

function renderFeedback(container, items, emptyMessage) {
  container.replaceChildren();

  if (!items.length) {
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

    comparison.append(original, arrow, suggestion);

    const explanation = document.createElement("p");
    explanation.className = "feedback-explanation";
    explanation.textContent = item.explanation;

    li.append(comparison, explanation);
    container.appendChild(li);
  });
}

function renderInputIssues(items) {
  inputIssues.replaceChildren();
  inputIssuesSection.hidden = items.length === 0;

  const labels = {
    spelling: "Possible spelling issue",
    unrecognizable_text: "Unrecognizable text",
    language: "Language not supported",
  };

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "feedback-card input-issue-card";

    const heading = document.createElement("div");
    heading.className = "input-issue-heading";

    const type = document.createElement("span");
    type.className = "input-issue-type";
    type.textContent = labels[item.type] || "Input issue";

    const original = document.createElement("span");
    original.className = "feedback-original";
    original.textContent = item.original;

    heading.append(type, original);

    const explanation = document.createElement("p");
    explanation.className = "feedback-explanation";
    explanation.textContent = item.explanation;

    li.append(heading, explanation);
    inputIssues.appendChild(li);
  });
}

function setScore(element, progress, value) {
  const available = Number.isInteger(value) && value >= 0 && value <= 100;
  element.textContent = available ? `${value}%` : "N/A";
  progress.hidden = !available;
  progress.value = available ? value : 0;
  progress.setAttribute(
    "aria-label",
    available ? `Score: ${value} out of 100` : "Score unavailable"
  );
}

function displayResults(data) {
  const status = data.inputStatus || "valid";
  const issues = Array.isArray(data.inputIssues) ? data.inputIssues : [];
  const unableToEvaluate =
    status === "unrecognizable" ||
    status === "unsupported_language" ||
    (status === "partially_understandable" &&
      (data.grammarScore == null || data.clarityScore == null));

  setScore(grammarScore, grammarProgress, data.grammarScore);
  setScore(clarityScore, clarityProgress, data.clarityScore);

  const warnings = {
    unrecognizable: {
      title: "Unable to evaluate this text reliably",
      message:
        "The text does not contain enough recognizable English for a meaningful grammar and clarity analysis. Please review it and try again.",
    },
    unsupported_language: {
      title: "English text required",
      message:
        "This analyzer currently supports English. Please enter English text to receive grammar and clarity feedback.",
    },
    partially_understandable: {
      title: "Some text may be difficult to understand",
      message:
        "Parts of the input could not be interpreted confidently. Review the input issues below; scores may be unavailable or less reliable.",
    },
  };

  const warning = warnings[status];
  inputWarning.hidden = !warning;
  if (warning) {
    inputWarningTitle.textContent = warning.title;
    inputWarningMessage.textContent = warning.message;
  } else {
    inputWarningTitle.textContent = "";
    inputWarningMessage.textContent = "";
  }

  renderInputIssues(issues);

  writingFeedback.hidden = unableToEvaluate;
  if (!unableToEvaluate) {
    renderFeedback(
      grammarErrors,
      Array.isArray(data.grammarErrors) ? data.grammarErrors : [],
      "No grammar errors found."
    );
    renderFeedback(
      clarityImprovements,
      Array.isArray(data.clarityImprovements) ? data.clarityImprovements : [],
      "Your writing is already clear."
    );
  } else {
    grammarErrors.replaceChildren();
    clarityImprovements.replaceChildren();
  }

  improvedTextSection.hidden = unableToEvaluate;
  improvedTextHeading.textContent = "Improved Version";
  improvedText.textContent = data.improvedText || "";

  results.hidden = false;
  requestAnimationFrame(() => {
    results.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  });
}

analyzeBtn.addEventListener("click", async () => {
  const text = userText.value.trim();
  if (!text) {
    showNotification("Please enter a sentence or paragraph.");
    return;
  }

  if (text.length > 5000) {
    showNotification("Text must not exceed 5000 characters.");
    return;
  }

  hideNotification();
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  results.hidden = true;

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    displayResults(data);
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      showNotification("The analysis is taking too long. Please try again.");
    } else {
      showNotification(error.message);
    }
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Text";
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(improvedText.textContent);
    showNotification("Improved text copied successfully!", "success");
    copyBtn.textContent = "Copied!";
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyBtn.textContent = "Copy Improved Text";
    }, 2000);
  } catch {
    showNotification("Unable to copy text. Please copy it manually.");
  }
});

const themeOptions = document.querySelectorAll(".theme-option");
const validThemes = ["light", "dark", "sepia"];

function applyTheme(theme) {
  if (!validThemes.includes(theme)) return;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  themeOptions.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeValue === theme)
    );
  });
}

const savedTheme = localStorage.getItem("theme");
applyTheme(validThemes.includes(savedTheme) ? savedTheme : "light");

themeOptions.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeValue);
  });
});
