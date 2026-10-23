
require("dotenv").config();

const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function testGroqAnalysis() {
    const text = "Yesterday I goes to school and meet my friend. We was very happy because the teacher explain everything good.";

    try {
        const response = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",

            messages: [
                {
                    role: "system",
                    content: `
You are an expert English grammar and clarity analyzer.

Analyze the user's text and return ONLY a valid JSON object.

The JSON must have this exact structure:

{
    "grammarScore": 0,
    "clarityScore": 0,
    "grammarErrors": [
        {
            "original": "incorrect phrase",
            "suggestion": "corrected phrase",
            "explanation": "reason for correction"
        }
    ],
    "clarityImprovements": [
        {
            "original": "unclear phrase",
            "suggestion": "clearer phrase",
            "explanation": "reason for improvement"
        }
    ],
    "improvedText": "fully corrected text"
}

Rules:
- Scores must be integers between 0 and 100.
- Identify genuine grammar mistakes.
- Explain each correction clearly.
- Preserve the author's original meaning.
- Do not invent mistakes.
- If no issues exist, return empty arrays.
- Return JSON only, without Markdown formatting.
`
                },
                {
                    role: "user",
                    content: text
                }
            ],

            temperature: 0.2,

            response_format: {
                type: "json_object"
            }
        });

        const result = JSON.parse(
            response.choices[0].message.content
        );

        console.log("Grammar Score:", result.grammarScore);
        console.log("Clarity Score:", result.clarityScore);

        console.log("\nGrammar Errors:");
        console.log(JSON.stringify(result.grammarErrors, null, 2));

        console.log("\nClarity Improvements:");
        console.log(JSON.stringify(result.clarityImprovements, null, 2));

        console.log("\nImproved Text:");
        console.log(result.improvedText);

    } catch (error) {
        console.error("Groq error:", error.message);
    }
}

testGroqAnalysis();
