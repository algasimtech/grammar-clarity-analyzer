
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
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
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

// Shared instructions for Gemini and Groq
const SYSTEM_PROMPT = `
You are an expert English grammar, clarity, and input-quality analyzer.

Analyze the user's text and return structured JSON.

FIRST: INPUT QUALITY

Before evaluating grammar and clarity, determine whether the
submitted text contains recognizable and meaningful English.

Classify inputStatus as exactly one of:

- valid:
  The text contains recognizable English that can be analyzed.

- partially_understandable:
  Some English meaning is recognizable, but substantial spelling,
  word-recognition, or language problems affect understanding.

- unrecognizable:
  The text is predominantly gibberish, random characters,
  or meaningless combinations of words.

- unsupported_language:
  The text is predominantly written in a language other than English.

IMPORTANT INPUT RULES:
- Do not assume text is correct because no grammar errors were found.
- Do not assign perfect scores to meaningless text.
- Do not classify unfamiliar personal names as gibberish.
- Accept legitimate technical terms, abbreviations, and acronyms.
- Recognize valid English fragments and short expressions.
- Do not reject text merely because it lacks punctuation.
- Do not invent meanings for unrecognizable text.
- Do not classify genuine non-English language as gibberish.
- Do not treat every unusual word as a spelling mistake.
- If the input is ambiguous, avoid overconfident classifications.

INPUT ISSUES:

Return an inputIssues array.

Each input issue must contain:
- original: An exact substring from the submitted text.
- type: spelling, unrecognizable_text, or language.
- explanation: A concise explanation of the problem.

For spelling:
- Identify probable misspellings when sufficiently confident.
- Avoid flagging names, technical terminology, or valid variants.
- Explain the likely spelling problem.
- Do not invent a correction when the intended word is unclear.

For unrecognizable_text:
- Identify text that cannot be meaningfully interpreted.
- Explain why reliable analysis is not possible.

For language:
- Identify text predominantly written in another language.
- Explain that the analyzer currently supports English.

SECOND: GRAMMAR

For recognizable English, identify genuine grammatical errors
and explain each correction clearly.

- Do not treat stylistic preferences as grammatical errors.
- Analyze every sentence.
- Return an empty grammarErrors array when no errors exist.

THIRD: CLARITY

Clarity suggestions must focus on readability, word choice,
and sentence structure rather than simply repeating grammar corrections.

For clarityImprovements:
- Identify expressions that could be clearer, more precise,
  more natural, or easier to understand.
- Suggest meaningful improvements even when grammar is correct.
- Do not duplicate grammar corrections.
- Do not invent unnecessary suggestions.
- Return an empty array if the text is already clear.

FOURTH: IMPROVED TEXT

For improvedText:
- Correct grammar and improve clarity.
- Preserve the author's original meaning and tone.
- Do not introduce new information.
- Return the original text if no changes are needed.
- If the input is unrecognizable or unsupported,
  return the original text unchanged.

SCORING:

- Scores must be integers between 0 and 100 when available.
- A score of 100 means no issues were found in that category.
- Scores must reflect the severity of actual issues.
- Do not automatically reduce grammar scores for spelling alone.
- Do not automatically reduce clarity scores for stylistic preferences.

For inputStatus = valid:
- Provide both grammarScore and clarityScore.

For inputStatus = partially_understandable:
- Provide both scores only if enough meaningful English exists
  to evaluate reliably.
- Otherwise return null for both scores.

For inputStatus = unrecognizable or unsupported_language:
- Set grammarScore to null.
- Set clarityScore to null.
- Set grammarErrors to [].
- Set clarityImprovements to [].
- Keep improvedText identical to the original input.
- Return at least one relevant input issue.

FEEDBACK:

- Return grammarErrors and clarityImprovements as separate arrays.
- Each item must contain original, suggestion, and explanation.
- The original field must quote an exact substring from the input.
- The suggestion field must contain its improved replacement.
- Keep feedback in the order issues appear in the input.
- If no issues exist in a category, return an empty array.
- Avoid reporting the same issue multiple times.
- Do not invent errors.

OUTPUT:

Return only valid JSON matching this structure:

{
  "inputStatus": "valid",
  "inputIssues": [],
  "grammarScore": 100,
  "clarityScore": 100,
  "grammarErrors": [],
  "clarityImprovements": [],
  "improvedText": "Original or improved text"
}

All seven fields are required.
`;

// Schema for grammar and clarity feedback
const feedbackSchema = {
  type: Type.OBJECT,
  properties: {
    original: { type: Type.STRING },
    suggestion: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: [
    "original",
    "suggestion",
    "explanation",
  ],
};

// Schema for input quality issues
const inputIssueSchema = {
  type: Type.OBJECT,
  properties: {
    original: { type: Type.STRING },
    type: {
      type: Type.STRING,
      enum: [
        "spelling",
        "unrecognizable_text",
        "language",
      ],
    },
    explanation: { type: Type.STRING },
  },
  required: [
    "original",
    "type",
    "explanation",
  ],
};

// Shared Gemini response schema
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    inputStatus: {
      type: Type.STRING,
      enum: [
        "valid",
        "partially_understandable",
        "unrecognizable",
        "unsupported_language",
      ],
    },

    inputIssues: {
      type: Type.ARRAY,
      items: inputIssueSchema,
    },

    grammarScore: {
      type: Type.INTEGER,
      nullable: true,
    },

    clarityScore: {
      type: Type.INTEGER,
      nullable: true,
    },

    grammarErrors: {
      type: Type.ARRAY,
      items: feedbackSchema,
    },

    clarityImprovements: {
      type: Type.ARRAY,
      items: feedbackSchema,
    },

    improvedText: {
      type: Type.STRING,
    },
  },

  required: [
    "inputStatus",
    "inputIssues",
    "grammarScore",
    "clarityScore",
    "grammarErrors",
    "clarityImprovements",
    "improvedText",
  ],
};

// Validate responses from both AI providers
function validateAnalysis(analysis, text) {
  if (
    analysis === null ||
    typeof analysis !== "object" ||
    Array.isArray(analysis)
  ) {
    return false;
  }

  const validStatuses = [
    "valid",
    "partially_understandable",
    "unrecognizable",
    "unsupported_language",
  ];

  const validIssueTypes = [
    "spelling",
    "unrecognizable_text",
    "language",
  ];

  const validScore = (value) =>
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100;

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

  const validInputIssue = (item) =>
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.original === "string" &&
    item.original.trim().length > 0 &&
    text.includes(item.original) &&
    validIssueTypes.includes(item.type) &&
    typeof item.explanation === "string" &&
    item.explanation.trim().length > 0;

  if (!validStatuses.includes(analysis.inputStatus)) {
    return false;
  }

  if (
    !Array.isArray(analysis.inputIssues) ||
    !analysis.inputIssues.every(validInputIssue)
  ) {
    return false;
  }

  if (
    !Array.isArray(analysis.grammarErrors) ||
    !analysis.grammarErrors.every(validFeedback)
  ) {
    return false;
  }

  if (
    !Array.isArray(analysis.clarityImprovements) ||
    !analysis.clarityImprovements.every(validFeedback)
  ) {
    return false;
  }

  if (
    typeof analysis.improvedText !== "string" ||
    !analysis.improvedText.trim()
  ) {
    return false;
  }

  const scoresAvailable =
    validScore(analysis.grammarScore) &&
    validScore(analysis.clarityScore);

  const scoresUnavailable =
    analysis.grammarScore === null &&
    analysis.clarityScore === null;

  if (analysis.inputStatus === "valid") {
    return scoresAvailable;
  }

  if (
    analysis.inputStatus ===
    "partially_understandable"
  ) {
    return (
      scoresAvailable ||
      scoresUnavailable
    );
  }

  if (
    analysis.inputStatus === "unrecognizable" ||
    analysis.inputStatus === "unsupported_language"
  ) {
    const expectedIssueType =
      analysis.inputStatus === "unrecognizable"
        ? "unrecognizable_text"
        : "language";

    return (
      scoresUnavailable &&
      analysis.grammarErrors.length === 0 &&
      analysis.clarityImprovements.length === 0 &&
      analysis.inputIssues.some(
        (issue) => issue.type === expectedIssueType
      ) &&
      analysis.improvedText === text
    );
  }

  return false;
}

// Parse and validate an AI response
function parseAnalysis(content, text) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI returned an empty response");
  }

  const analysis = JSON.parse(content);

  if (!validateAnalysis(analysis, text)) {
    throw new Error("Invalid AI analysis response format");
  }

  return analysis;
}

// Analyze text using Gemini
async function analyzeWithGemini(text) {
  if (!gemini) {
    throw new Error("Gemini API key is not configured");
  }

  console.log(
    `Analyzing with Gemini (${GEMINI_MODEL})...`
  );

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

// Analyze text using Groq
async function analyzeWithGroq(text) {
  if (!groq) {
    throw new Error("Groq API key is not configured");
  }

  console.log(
    `Analyzing with Groq (${GROQ_MODEL})...`
  );

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

  const content =
    response.choices?.[0]?.message?.content;

  return parseAnalysis(content, text);
}

// Gemini primary, Groq fallback
async function analyzeText(text) {
  try {
    const result = await analyzeWithGemini(text);

    console.log("Gemini analysis successful.");

    return result;
  } catch (geminiError) {
    console.error(
      "Gemini failed:",
      geminiError.message
    );

    console.log("Switching to Groq fallback...");

    try {
      const result = await analyzeWithGroq(text);

      console.log("Groq fallback successful.");

      return result;
    } catch (groqError) {
      console.error(
        "Groq failed:",
        groqError.message
      );

      throw new Error("Both AI providers failed");
    }
  }
}

// Analyze API endpoint
app.post("/api/analyze", async (req, res) => {
  const { text } = req.body || {};

  if (
    typeof text !== "string" ||
    !text.trim()
  ) {
    return res.status(400).json({
      error: "Please enter a sentence or paragraph.",
    });
  }

  if (text.length > 5000) {
    return res.status(400).json({
      error: "Text must not exceed 5000 characters.",
    });
  }

  // Mock mode for local frontend testing
  if (process.env.MOCK_AI === "true") {
    return res.json({
      inputStatus: "valid",
      inputIssues: [],
      grammarScore: 45,
      clarityScore: 82,
      grammarErrors: [
        {
          original: "I goes",
          suggestion: "I went",
          explanation:
            "Use the correct past tense.",
        },
      ],
      clarityImprovements: [
        {
          original: "very very difficult",
          suggestion: "extremely difficult",
          explanation:
            "Avoid unnecessary repetition.",
        },
      ],
      improvedText:
        "Yesterday I went to school. The assignment was extremely difficult.",
    });
  }

  try {
    const analysis = await analyzeText(text);

    return res.json(analysis);
  } catch (error) {
    console.error(
      "Analysis failed:",
      error.message
    );

    return res.status(503).json({
      error:
        "The AI analysis service is temporarily unavailable. Please try again later.",
    });
  }
});

// Start the server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
