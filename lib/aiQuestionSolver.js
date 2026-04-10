import { solveQuestionsWithAI, isGeminiConfigurationError } from './gemini';

export { isGeminiConfigurationError };

/**
 * Solve a single quiz question using Google Gemini with structured output.
 *
 * @param {string} questionText  - The question text
 * @param {string[]} choices     - Array of answer choice texts (in order)
 * @param {string} apiKey        - Google Gemini API key (Ignored, uses process.env.GEMINI_API_KEY)
 * @param {string} model         - Gemini model (ignored, uses gemini-2.0-flash)
 * @returns {Promise<{correct_answer_number, correct_answer_text, reasoning, confidence, success}>}
 */
export async function solveQuestion(
  questionText,
  choices,
  apiKey,
  model = 'gemini-2.0-flash'
) {
  if (!choices || choices.length === 0) {
    throw new Error('Must provide at least one answer choice');
  }

  // Map choices to the format expected by solveQuestionsWithAI
  const formattedChoices = choices.map((text, i) => ({ value: String(i), text }));

  const results = await solveQuestionsWithAI([{
    slot: 1,
    questionText,
    choices: formattedChoices
  }]);

  if (!results || results.length === 0) {
    throw new Error('Empty response from Gemini');
  }

  const answer = results[0];

  return {
    correct_answer_number: parseInt(answer.chosen_value),
    correct_answer_text:   answer.chosen_text,
    reasoning:             answer.reasoning,
    confidence:            answer.confidence,
    success: true,
  };
}

/**
 * Solve multiple quiz questions in batch.
 *
 * @param {Array<{question_text, choices, slot}>} questions
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<Array>}
 */
export async function solveMultipleQuestions(questions, apiKey, model = 'gemini-2.0-flash') {
  // Map questions to the format expected by solveQuestionsWithAI
  const formattedQuestions = questions.map(q => ({
    slot: q.slot,
    questionText: q.question_text || '',
    choices: (q.choices || []).map((text, i) => ({ value: String(i), text }))
  }));

  const aiAnswers = await solveQuestionsWithAI(formattedQuestions);

  if (!aiAnswers || aiAnswers.length === 0) {
    return questions.map(q => ({
      slot: q.slot,
      success: false,
      error: 'Gemini did not return any answers',
    }));
  }

  // Map back to the legacy results format
  return aiAnswers.map(answer => ({
    slot: answer.slot,
    correct_answer_number: parseInt(answer.chosen_value),
    correct_answer_text: answer.chosen_text,
    reasoning: answer.reasoning,
    confidence: answer.confidence,
    success: true,
  }));
}