// lib/moodleQuizAttempt.js
import { callMoodleAPI } from "./moodle";

export async function startQuizAttempt(moodleUrl, token, quizId) {
  const data = await callMoodleAPI(moodleUrl, token, "mod_quiz_start_attempt", {
    quizid: quizId,
  });
  if (!data?.attempt) throw new Error("Failed to start attempt: " + JSON.stringify(data));
  return data.attempt;
}

export async function getAllQuestions(moodleUrl, token, attemptId) {
  const allQuestions = [];
  let page = 0;

  while (true) {
    const data = await callMoodleAPI(
      moodleUrl, token,
      "mod_quiz_get_attempt_data",
      { attemptid: attemptId, page }
    );

    const questions = data?.questions || [];
    allQuestions.push(...questions);

    const next = data?.nextpage ?? -1;
    if (next === -1 || questions.length === 0) break;
    page = next;
  }

  return allQuestions;
}

export function parseQuestion(rawQ) {
  const html = rawQ.html || "";

  // 1. Question Text extraction (using your log's specific HTML)
  const qtextMatch = html.match(/class=["']qtext["'][^>]*>([\s\S]*?)<\/div>/i) || 
                    html.match(/class=["'][^"']*qtext[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                    
  let questionText = qtextMatch 
    ? qtextMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() 
    : (rawQ.questionsummary || "");

  const choices = [];
  const choiceInputs = [];

  // 2. Modern Moodle extraction using aria-labelledby (seen in your logs)
  // Example: <input type="radio" ... id="q60:5_answer0" aria-labelledby="q60:5_answer0_label" />
  const ariaInputRegex = /<input[^>]+type="(radio|checkbox)"[^>]+aria-labelledby="([^"]+)"/gi;
  let inputMatch;
  while ((inputMatch = ariaInputRegex.exec(html)) !== null) {
    const fullInputTag = inputMatch[0];
    const labelId = inputMatch[2]; // e.g. "q60:5_answer0_label"
    
    const nameMatch = fullInputTag.match(/name="([^"]+)"/i);
    const valueMatch = fullInputTag.match(/value="([^"]*)"/i);

    if (nameMatch && valueMatch) {
      // Find the label-pointing div (seen in your logs)
      const labelDivRegex = new RegExp(`id=["']${labelId}["'][^>]*>([\\s\\S]*?)<\\/div>`, "i");
      const labelDivMatch = html.match(labelDivRegex);
      
      let labelText = "";
      if (labelDivMatch) {
        // Remove nested span/div tags like <span class="answernumber">a. </span>
        labelText = labelDivMatch[1]
          .replace(/<span[^>]*class="answernumber"[^>]*>[\s\S]*?<\/span>/gi, "")
          .replace(/<div[^>]*class="grade"[^>]*>[\s\S]*?<\/div>/gi, "")
          .replace(/<div[^>]*class="validationerror"[^>]*>[\s\S]*?<\/div>/gi, "");
        
        labelText = labelText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }

      // Filter out junk text like "Flag question" or empty labels
      if (labelText && !/flag question|clear my choice/i.test(labelText)) {
        choices.push(labelText);
        choiceInputs.push({
          name: nameMatch[1],
          value: valueMatch[1],
          text: labelText
        });
      }
    }
  }

  // 3. Fallback to old "label for" or "row" logic if aria failed
  if (choices.length === 0) {
    const inputRegex = /<input[^>]+type="(radio|checkbox)"[^>]*>/gi;
    let fallbackInput;
    while ((fallbackInput = inputRegex.exec(html)) !== null) {
      const tag = fallbackInput[0];
      const idMatch = tag.match(/id="([^"]+)"/i);
      if (idMatch) {
        const id = idMatch[1];
        const forLabelMatch = html.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([\\s\\S]*?)<\\/label>`, "i"));
        if (forLabelMatch) {
          const text = forLabelMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          choices.push(text);
          choiceInputs.push({
            name: tag.match(/name="([^"]+)"/i)?.[1],
            value: tag.match(/value="([^"]*)"/i)?.[1],
            text
          });
        }
      }
    }
  }

  const seqMatch = html.match(/name="([^"]*:sequencecheck)"[^>]*value="(\d+)"/i);
  const sequencecheckName  = seqMatch ? seqMatch[1] : null;
  const sequencecheckValue = seqMatch ? seqMatch[2] : (rawQ.sequencecheck ?? 1);

  return {
    slot: rawQ.slot,
    type: rawQ.type,
    question_text: questionText,
    choices,
    choiceInputs,
    sequencecheckName,
    sequencecheckValue,
    html,
  };
}

export async function submitAnswer(moodleUrl, token, attemptId, parsedQuestion, answerIndex) {
  const q = parsedQuestion;
  const dataFields = [];
  const seqName = q.sequencecheckName || `q${attemptId}:${q.slot}_:sequencecheck`;
  dataFields.push({ name: seqName, value: String(q.sequencecheckValue || 1) });

  if (q.choiceInputs && q.choiceInputs[answerIndex]) {
    dataFields.push({
      name:  q.choiceInputs[answerIndex].name,
      value: q.choiceInputs[answerIndex].value,
    });
  } else {
    dataFields.push({
      name:  `q${attemptId}:${q.slot}_answer`,
      value: String(answerIndex),
    });
  }

  return await callMoodleAPI(moodleUrl, token, "mod_quiz_save_attempt", {
    attemptid: attemptId,
    data: dataFields
  });
}

export async function submitQuizAttempt(moodleUrl, token, attemptId) {
  return await callMoodleAPI(moodleUrl, token, "mod_quiz_process_attempt", {
    attemptid: attemptId,
    finishattempt: 1,
    timeup: 0
  });
}

export async function getAttemptResult(moodleUrl, token, attemptId) {
  return await callMoodleAPI(moodleUrl, token, "mod_quiz_get_attempt_review", {
    attemptid: attemptId
  });
}

export async function getQuizAttemptMarks(moodleUrl, token, quizId, userId) {
  const params = { quizid: quizId, status: "all" };
  if (userId) params.userid = userId;

  const attemptsRes = await callMoodleAPI(moodleUrl, token, "mod_quiz_get_user_attempts", params);
  const attempts = attemptsRes?.attempts || [];

  const finishedAttempts = attempts.filter((attempt) => attempt.state === "finished");
  const inProgressAttempts = attempts.filter((attempt) => attempt.state === "inprogress");

  const latestAttempt = [...attempts].sort((a, b) => {
    const timeDiff = (b.timestart || 0) - (a.timestart || 0);
    return timeDiff !== 0 ? timeDiff : (b.id || 0) - (a.id || 0);
  })[0] || null;

  return {
    totalAttempts: attempts.length,
    finishedAttempts: finishedAttempts.length,
    inProgressAttempts: inProgressAttempts.length,
    lastGrade: finishedAttempts.length > 0 ? finishedAttempts[finishedAttempts.length - 1].sumgrades : null,
    currentGrade: inProgressAttempts.length > 0 ? inProgressAttempts[0].sumgrades : null,
    latestAttemptGrade: latestAttempt?.sumgrades ?? null,
    latestAttemptState: latestAttempt?.state ?? null,
  };
}
