
require("dotenv").config();

const { GoogleGenAI, Type } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const DEFAULT_MODEL = "gemini-3.5-flash";

const sampleText =
    "Yesterday I goes to school and meet my friend. We was very happy because the teacher explain everything good.";

const feedbackSchema = {
    type: Type.OBJECT,
    properties: {
        original: { type: Type.STRING },
        suggestion: { type: Type.STRING },
        explanation: { type: Type.STRING }
    },
    required: ["original", "suggestion", "explanation"]
};

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        grammarScore: { type: Type.INTEGER },
        clarityScore: { type: Type.INTEGER },
        grammarErrors: {
            type: Type.ARRAY,
            items: feedbackSchema
        },
        clarityImprovements: {
            type: Type.ARRAY,
            items: feedbackSchema
        },
        improvedText: { type: Type.STRING }
    },
    required: [
        "grammarScore",
        "clarityScore",
        "grammarErrors",
        "clarityImprovements",
        "improvedText"
    ]
};

async function listModels() {
    try {
        console.log("\nAvailable Gemini models:\n");

        const models = await ai.models.list();

        for await (const model of models) {
            console.log(model.name);
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

async function testGrammar(model) {
    console.log(`\nTesting grammar correction with ${model}`);

    const start = Date.now();

    try {
        const response = await ai.models.generateContent({
            model,
            contents: "Correct this sentence: Yesterday I goes to school and meet my friend.",
            config: {
                systemInstruction:
                    "Correct grammatical errors while preserving the original meaning.",
                temperature: 0.2,
                abortSignal: AbortSignal.timeout(30000)
            }
        });

        console.log("Status: SUCCESS");
        console.log(
            "Response time:",
            ((Date.now() - start) / 1000).toFixed(2),
            "seconds"
        );
        console.log("Response:", response.text);

    } catch (error) {
        console.log("Status: FAILED");
        console.log("Error:", error.message);
    }
}

async function testAnalysis(model) {
    console.log(`\nTesting structured analysis with ${model}`);

    const start = Date.now();

    try {
        const response = await ai.models.generateContent({
            model,
            contents: sampleText,
            config: {
                systemInstruction: `
You are an expert English grammar and clarity analyzer.

Analyze the user's text and return structured JSON.

Identify genuine grammar errors and explain each correction.

Clarity suggestions must focus on readability, word choice,
and sentence structure rather than repeating grammar corrections.

Preserve the author's original meaning.

Scores must be integers between 0 and 100.
`,
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
                temperature: 0.2,
                abortSignal: AbortSignal.timeout(30000)
            }
        });

        const result = JSON.parse(response.text);

        console.log("Status: SUCCESS");
        console.log(
            "Response time:",
            ((Date.now() - start) / 1000).toFixed(2),
            "seconds"
        );

        console.log("\nGrammar Score:", result.grammarScore);
        console.log("Clarity Score:", result.clarityScore);

        console.log("\nGrammar Errors:");
        console.log(JSON.stringify(result.grammarErrors, null, 2));

        console.log("\nClarity Improvements:");
        console.log(JSON.stringify(result.clarityImprovements, null, 2));

        console.log("\nImproved Text:");
        console.log(result.improvedText);

    } catch (error) {
        console.log("Status: FAILED");
        console.log(
            "Response time:",
            ((Date.now() - start) / 1000).toFixed(2),
            "seconds"
        );
        console.log("Error:", error.message);
    }
}

async function main() {
    const command = process.argv[2] || "analyze";
    const model = process.argv[3] || DEFAULT_MODEL;

    switch (command) {
        case "list":
            await listModels();
            break;

        case "grammar":
            await testGrammar(model);
            break;

        case "analyze":
            await testAnalysis(model);
            break;

        default:
            console.log("Available commands:");
            console.log("  node test-gemini.js list");
            console.log("  node test-gemini.js grammar [model]");
            console.log("  node test-gemini.js analyze [model]");
    }
}

main();
