import { GoogleGenerativeAI } from "@google/generative-ai";

function createGeminiConfigurationError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.isConfigurationError = true;
  return error;
}

export function hasGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function isGeminiConfigurationError(error) {
  if (!error) return false;

  if (error.isConfigurationError) return true;

  const message = error.message || "";
  const details = Array.isArray(error.errorDetails) ? error.errorDetails : [];
  const hasApiKeyInvalidReason = details.some((d) => d?.reason === "API_KEY_INVALID");

  return (
    error.code === "GEMINI_API_KEY_MISSING" ||
    error.code === "GEMINI_API_KEY_INVALID" ||
    hasApiKeyInvalidReason ||
    message.includes("API Key not found") ||
    message.includes("API_KEY_INVALID")
  );
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw createGeminiConfigurationError(
      "Gemini API key is missing. Set GEMINI_API_KEY in your environment and restart the server.",
      "GEMINI_API_KEY_MISSING"
    );
  }

  return new GoogleGenerativeAI(apiKey);
}

const QUIZ_TOOL = {
  functionDeclarations: [
    {
      name: "answer_quiz_questions",
      description: "Given a list of quiz questions with their answer choices, return the correct answer value for each question. Use your knowledge to pick the most accurate answer.",
      parameters: {
        type: "object",
        properties: {
          answers: {
            type: "array",
            description: "One entry per question in the same order as provided.",
            items: {
              type: "object",
              properties: {
                slot: {
                  type: "integer",
                  description: "The question slot number.",
                },
                chosen_value: {
                  type: "string",
                  description: "The 'value' field of the correct choice (e.g. '0', '1', '2', '3' for MCQ or '0'/'1' for True/False).",
                },
                chosen_text: {
                  type: "string",
                  description: "The text of the chosen answer (for logging).",
                },
                confidence: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "How confident you are in this answer.",
                },
                reasoning: {
                  type: "string",
                  description: "Brief one-line reason for the choice.",
                },
              },
              required: ["slot", "chosen_value", "chosen_text", "confidence", "reasoning"],
            },
          },
        },
        required: ["answers"],
      },
    },
  ],
};

/**
 * Enhanced AI solver for multiple choice questions using Function Calling
 * Returns: { value: <moodle_choice_value>, text: <choice_text> }
 */
export async function solveQuestionsWithAI(questions = []) {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [QUIZ_TOOL],
    });

    const promptParts = [
      "You are an expert at answering quiz questions accurately.",
      "Below are the quiz questions. For each one, pick the single best answer.",
      "Call the function `answer_quiz_questions` with your answers.\n",
    ];

    questions.forEach((q) => {
      promptParts.push(`--- Question (slot ${q.slot}) [${q.type || "unknown"}] ---`);
      promptParts.push(q.questionText || q.text);
      if (q.options || q.choices) {
        (q.options || q.choices).forEach((c) => {
          promptParts.push(`  value=${c.value}  →  ${c.text}`);
        });
      }
      promptParts.push("");
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: promptParts.join("\n") }] }],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["answer_quiz_questions"],
        },
      },
    });

    const response = await result.response;
    const functionCall = response.candidates[0].content.parts.find(p => p.functionCall);

    if (functionCall) {
      return functionCall.functionCall.args.answers;
    }

    throw new Error("Gemini did not return a function call response.");
  } catch (error) {
    console.error("Gemini solving error:", error);

    if (isGeminiConfigurationError(error)) {
      throw createGeminiConfigurationError(
        "Gemini API key is invalid or missing. Update GEMINI_API_KEY and restart the server.",
        error.code || "GEMINI_API_KEY_INVALID"
      );
    }

    throw error; // Re-throw so callers can handle it properly
  }
}

/**
 * Legacy wrapper for single question solving
 */
export async function solveQuestionWithAI(questionText, options = []) {
  const results = await solveQuestionsWithAI([{
    slot: 1,
    questionText,
    options
  }]);
  
  if (results && results.length > 0) {
    return results[0].chosen_value;
  }
  return options.length > 0 ? options[0].value : null;
}

