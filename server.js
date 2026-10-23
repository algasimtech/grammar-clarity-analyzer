const express = require("express");
require("dotenv").config();

const { GoogleGenAI, Type } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(request) {
  const delays = [2000, 4000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      const status = Number(error.status || error.code);

      const retryable = status === 503 || status === 429;

      if (!retryable || attempt === delays.length) {
        throw error;
      }

      console.log(`Gemini unavailable (${status}). Retrying...`);

      await sleep(delays[attempt]);
    }
  }
}

const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Allow the server to receive JSON data
app.use(express.json());

// Serve HTML, CSS, and JavaScript files
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/analyze", async (req, res) => {
  const { text } = req.body || {};

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      error: "Please enter a sentence or paragraph.",
    });
  }

  if (text.length > 5000) {
    return res.status(400).json({
      error: "Text must not exceed 5000 characters.",
    });
  }

  if (process.env.MOCK_AI === "true") {
    const mockAnalysis = {
      grammarScore: 45,
      clarityScore: 82,
      grammarErrors: [
        {
          original: "I goes",
          suggestion: "I went",
          explanation:
            "Use the past tense because the action happened yesterday.",
        },
        {
          original: "My teacher give",
          suggestion: "My teacher gave",
          explanation: "The verb should be in the past tense.",
        },
        {
          original: "I don't understand",
          suggestion: "I didn't understand",
          explanation:
            "Maintain consistent past tense throughout the paragraph.",
        },
      ],
      clarityImprovements: [
        {
          original: "very very difficult",
          suggestion: "extremely difficult",
          explanation: "Avoid unnecessary repetition for clearer writing.",
        },
      ],
      improvedText:
        "Yesterday I went to school. My teacher gave us an assignment. The assignment was extremely difficult, and I didn't understand it.",
    };

    return res.json(mockAnalysis);
  }

  try {
    const response = await generateWithRetry({
      model: "gemini-3.8-flash",
      contents: text,
      config: {
        systemInstruction: `
You are an expert English grammar and clarity evaluator.

Analyze the user's sentence or paragraph.

Evaluate grammar and clarity separately.

GRAMMAR:
- Give a grammar correctness score from 0 to 100.
- Identify actual grammatical errors.
- Explain each error and suggest its correction.
- If there are no grammatical errors, return an empty array.
- Do not treat stylistic preferences as grammar errors.

CLARITY:
- Give a clarity score from 0 to 100.
- Identify unclear, wordy, or awkward expressions.
- Explain how each could be improved.
- If the text is already clear, return an empty array.

IMPROVED TEXT:
- Rewrite the text with correct grammar and better clarity.
- Preserve the original meaning and tone.
- Do not introduce new information.
- If no improvement is necessary, return the original text.

SCORING:
- 100 means no issues found in that category.
- Keep scores consistent with the severity of the issues.
- Evaluate paragraphs as a whole.


FEEDBACK FORMAT:
- Return grammarErrors and clarityImprovements as arrays of objects.
- Each object must contain original, suggestion, and explanation.
- The original field must quote an exact word or phrase from the user's input.
- The suggestion field must contain the corrected or improved version.
- The explanation field must explain why the change is needed.
- Analyze every sentence in a paragraph.
- Return a separate feedback object for each distinct issue.
- Avoid reporting the same issue in both categories.
- Do not invent errors or quote text that does not appear in the input.
- Keep feedback in the same order as the issues appear in the text.
`,
        responseMimeType: "application/json",

        responseSchema: {
          type: Type.OBJECT,
          properties: {
            grammarScore: {
              type: Type.INTEGER,
            },
            clarityScore: {
              type: Type.INTEGER,
            },
            grammarErrors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: {
                    type: Type.STRING,
                  },
                  suggestion: {
                    type: Type.STRING,
                  },
                  explanation: {
                    type: Type.STRING,
                  },
                },
                required: ["original", "suggestion", "explanation"],
              },
            },
            clarityImprovements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: {
                    type: Type.STRING,
                  },
                  suggestion: {
                    type: Type.STRING,
                  },
                  explanation: {
                    type: Type.STRING,
                  },
                },
                required: ["original", "suggestion", "explanation"],
              },
            },
            improvedText: {
              type: Type.STRING,
            },
          },
          required: [
            "grammarScore",
            "clarityScore",
            "grammarErrors",
            "clarityImprovements",
            "improvedText",
          ],
        },
      },
    });

    const analysis = JSON.parse(response.text);

    // Validate the structure before sending it to the frontend
    const validScore = (value) =>
      Number.isInteger(value) && value >= 0 && value <= 100;

    const isValidFeedback = (item) =>
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof item.original === "string" &&
      typeof item.suggestion === "string" &&
      typeof item.explanation === "string" &&
      item.original.trim().length > 0 &&
      text.includes(item.original);

    if (
      !validScore(analysis.grammarScore) ||
      !validScore(analysis.clarityScore) ||
      !Array.isArray(analysis.grammarErrors) ||
      !analysis.grammarErrors.every(isValidFeedback) ||
      !Array.isArray(analysis.clarityImprovements) ||
      !analysis.clarityImprovements.every(isValidFeedback) ||
      typeof analysis.improvedText !== "string"
    ) {
      throw new Error("Invalid Gemini response format");
    }

    res.json(analysis);
  } catch (error) {
    console.error("Gemini analysis failed:", error.message);

    const status = error.status || error.code;

    if (status === 503) {
      return res.status(503).json({
        error: "Gemini is currently busy. Please try again later.",
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: "Gemini request limit reached. Please check your API quota.",
      });
    }

    res.status(502).json({
      error: "Unable to analyze the text. Please try again.",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
