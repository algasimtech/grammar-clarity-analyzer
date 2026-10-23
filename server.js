
const express = require("express");
const path = require("path");
require("dotenv").config();

const { GoogleGenAI, Type } = require("@google/genai");
const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_MODEL = "gemini-3.5-flash";
const GROQ_MODEL = "openai/gpt-oss-20b";

const GEMINI_TIMEOUT = 20000;
const GROQ_TIMEOUT = 20000;

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const groq = process.env.GROQ_API_KEY
  ? new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: GROQ_TIMEOUT,
      maxRetries: 0,
    })
  : null;

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));


const SYSTEM_PROMPT = `
You are an expert English grammar and clarity analyzer.

Analyze the user's text and return structured JSON.

Identify genuine grammar errors and explain each correction clearly.

Clarity suggestions must focus on readability, word choice,
and sentence structure rather than simply repeating grammar corrections.

Preserve the author's original meaning and tone.

Scores must be integers between 0 and 100.

A score of 100 means no issues were found in that category.

Analyze every sentence in the user's text.

For grammarErrors:
- Identify actual grammatical mistakes.
- Explain why each correction is needed.
- Do not treat stylistic preferences as grammatical errors.

For clarityImprovements:
- Identify expressions that could be clearer, more precise,
  more natural, or easier to understand.
- Suggest meaningful improvements even when the grammar
  is already correct.
- Do not duplicate grammar corrections.
- Do not invent unnecessary suggestions.

For improvedText:
- Correct grammar and improve clarity.
- Preserve the original meaning.
- Do not introduce new information.
- Return the original text if no changes are needed.

For feedback:
- Return separate grammarErrors and clarityImprovements arrays.
- Each item must contain original, suggestion, and explanation.
- The original field must quote an exact phrase from the user's input.
- The suggestion field must contain its improved replacement.
- Keep feedback in the order issues appear in the input.
- If no issues exist in a category, return an empty array.

Return only valid JSON matching the required response structure.
`;

const feedbackSchema = {
  type: Type.OBJECT,
  properties: {
    original: { type: Type.STRING },
    suggestion: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ["original", "suggestion", "explanation"],
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    grammarScore: { type: Type.INTEGER },
    clarityScore: { type: Type.INTEGER },
    grammarErrors: {
      type: Type.ARRAY,
      items: feedbackSchema,
    },
    clarityImprovements: {
      type: Type.ARRAY,
      items: feedbackSchema,
    },
    improvedText: { type: Type.STRING },
  },
  required: [
    "grammarScore",
    "clarityScore",
    "grammarErrors",
    "clarityImprovements",
    "improvedText",
  ],
};

function validateAnalysis(analysis, text) {
  const validScore = (value) =>
    Number.isInteger(value) && value >= 0 && value <= 100;

  const validFeedback = (item) =>
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.original === "string" &&
    item.original.trim().length > 0 &&
    text.includes(item.original) &&
    typeof item.suggestion === "string" &&
    item.suggestion.trim().length > 0 &&
    typeof item.explanation === "string" &&
    item.explanation.trim().length > 0;

  return (
    analysis !== null &&
    typeof analysis === "object" &&
    !Array.isArray(analysis) &&
    validScore(analysis.grammarScore) &&
    validScore(analysis.clarityScore) &&
    Array.isArray(analysis.grammarErrors) &&
    analysis.grammarErrors.every(validFeedback) &&
    Array.isArray(analysis.clarityImprovements) &&
    analysis.clarityImprovements.every(validFeedback) &&
    typeof analysis.improvedText === "string" &&
    analysis.improvedText.trim().length > 0
  );
}

function parseAnalysis(content, text) {
  const analysis = JSON.parse(content);

  if (!validateAnalysis(analysis, text)) {
    throw new Error("Invalid AI analysis response format");
  }

  return analysis;
}

async function analyzeWithGemini(text) {
  if (!gemini) {
    throw new Error("Gemini API key is not configured");
  }

  console.log(`Analyzing with Gemini (${GEMINI_MODEL})...`);

  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: text,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT),
    },
  });

  return parseAnalysis(response.text, text);
}

async function analyzeWithGroq(text) {
  if (!groq) {
    throw new Error("Groq API key is not configured");
  }

  console.log(`Analyzing with Groq (${GROQ_MODEL})...`);

  const response = await groq.chat.completions.create(
    {
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.2,
      response_format: {
        type: "json_object",
      },
    },
    {
      timeout: GROQ_TIMEOUT,
      maxRetries: 0,
    }
  );

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty response");
  }

  return parseAnalysis(content, text);
}

async function analyzeText(text) {
  try {
    const result = await analyzeWithGemini(text);

    console.log("Gemini analysis successful.");

    return result;
  } catch (geminiError) {
    console.error("Gemini failed:", geminiError.message);

    console.log("Switching to Groq fallback...");

    try {
      const result = await analyzeWithGroq(text);

      console.log("Groq fallback successful.");

      return result;
    } catch (groqError) {
      console.error("Groq failed:", groqError.message);

      throw new Error("Both AI providers failed");
    }
  }
}

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
    return res.json({
      grammarScore: 45,
      clarityScore: 82,
      grammarErrors: [
        {
          original: "I goes",
          suggestion: "I went",
          explanation: "Use the correct past tense.",
        },
      ],
      clarityImprovements: [
        {
          original: "very very difficult",
          suggestion: "extremely difficult",
          explanation: "Avoid unnecessary repetition.",
        },
      ],
      improvedText:
        "Yesterday I went to school. The assignment was extremely difficult.",
    });
  }

  try {
    const analysis = await analyzeText(text);

    res.json(analysis);
  } catch (error) {
    console.error("Analysis failed:", error.message);

    res.status(503).json({
      error:
        "The AI analysis service is temporarily unavailable. Please try again later.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
