// server/src/modules/assessments/services/student.assessment.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const StudentAssessmentService = {
  /**
   * Fetches assessment details suitable for a student view (excluding sensitive info like answers).
   * @param {string} assessmentId - The ID of the assessment.
   * @returns {Promise<object|null>} The assessment details or null if not found or not published.
   */
  async getAssessmentDetailsForStudent(assessmentId) {
    const query = `
      SELECT
        id, course_id, title, description, time_limit_minutes,
        (SELECT COUNT(*) FROM Questions WHERE assessment_id = Assessments.id) AS question_count,
        settings ->> 'max_attempts' AS max_attempts, -- Extract from JSONB
        passing_score_percentage
      FROM Assessments
      WHERE id = $1 AND status = 'published';
    `;
    // Note: 'status' check ensures students only see published assessments.
    // The 'settings' are assumed to be stored in a JSONB column.
    try {
      const { rows } = await db.pool.query(query, [assessmentId]);
      if (rows.length === 0) {
        return null;
      }
      const assessment = rows[0];
      // Convert max_attempts to number if it exists, otherwise provide a default or handle as null
      assessment.max_attempts = assessment.max_attempts ? parseInt(assessment.max_attempts, 10) : 1; // Default to 1 if not set
      assessment.question_count = parseInt(assessment.question_count, 10);
      return assessment;
    } catch (error) {
      logger.error(`Error fetching assessment details for student (ID: ${assessmentId}): ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Starts an assessment attempt for a student.
   * - Checks for max attempts.
   * - Creates a new StudentSubmissions record.
   * @param {string} assessmentId - The ID of the assessment.
   * @param {string} studentId - The ID of the student.
   * @returns {Promise<object>} The newly created submission object.
   * @throws {Error} If max attempts exceeded or other eligibility criteria not met.
   */
  async startAssessmentAttempt(assessmentId, studentId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch assessment details, especially max_attempts from settings
      const assessmentQuery = "SELECT settings ->> 'max_attempts' AS max_attempts FROM Assessments WHERE id = $1 AND status = 'published';";
      const { rows: assessmentRows } = await client.query(assessmentQuery, [assessmentId]);
      if (assessmentRows.length === 0) {
        throw new Error('Assessment not found or not published.');
      }
      const max_attempts = assessmentRows[0].max_attempts ? parseInt(assessmentRows[0].max_attempts, 10) : 1; // Default 1 attempt

      // 2. Count existing completed or in-progress attempts by the student for this assessment
      //    (We might only count 'completed' ones if we allow resuming 'in-progress' ones without new attempt)
      const attemptsQuery = `
        SELECT COUNT(*) as attempt_count, MAX(attempt_number) as max_attempt_number
        FROM StudentSubmissions
        WHERE student_id = $1 AND assessment_id = $2;
        -- Add AND status != 'aborted' if aborted attempts don't count
      `;
      const { rows: attemptRows } = await client.query(attemptsQuery, [studentId, assessmentId]);
      const currentAttemptCount = parseInt(attemptRows[0].attempt_count, 10);
      const lastAttemptNumber = parseInt(attemptRows[0].max_attempt_number || 0, 10);

      if (max_attempts > 0 && currentAttemptCount >= max_attempts) {
        // More robust check: ensure all previous attempts are 'completed' or 'graded'
        // If there's an 'in-progress' one, maybe return that instead of creating a new one.
        // For now, simple check:
        throw new Error(`Maximum attempts (${max_attempts}) reached for this assessment.`);
      }

      const newAttemptNumber = lastAttemptNumber + 1;

      // 3. Create the new submission record
      const insertSubmissionQuery = `
        INSERT INTO StudentSubmissions (student_id, assessment_id, attempt_number, status, started_at)
        VALUES ($1, $2, $3, 'in-progress', NOW())
        RETURNING *;
      `;
      const { rows: submissionRows } = await client.query(insertSubmissionQuery, [studentId, assessmentId, newAttemptNumber]);

      await client.query('COMMIT');
      logger.info(`Student ${studentId} started attempt ${newAttemptNumber} for assessment ${assessmentId}. Submission ID: ${submissionRows[0].id}`);
      return submissionRows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error starting assessment attempt for student ${studentId}, assessment ${assessmentId}: ${error.message}`, { stack: error.stack });
      // Re-throw custom errors for controller to catch nicely
      if (error.message.startsWith('Maximum attempts')) throw error;
      if (error.message.startsWith('Assessment not found')) throw error;
      throw new Error('Failed to start assessment attempt.'); // Generic error
    } finally {
      client.release();
    }
  },

  /**
   * Fetches questions for a student's active submission.
   * Ensures the student owns the submission and it's 'in-progress'.
   * Questions are returned without revealing correct answers or specific answer feedback.
   * @param {string} submissionId - The ID of the student's submission.
   * @param {string} studentId - The ID of the student making the request.
   * @returns {Promise<Array>} Array of question objects with their options.
   * @throws {Error} If submission not found, not owned by student, or not in-progress.
   */
  async getQuestionsForSubmission(submissionId, studentId) {
    // 1. Verify the submission belongs to the student and is 'in-progress'
    const submissionQuery = 'SELECT id, assessment_id, status FROM StudentSubmissions WHERE id = $1 AND student_id = $2;';
    const { rows: submissionRows } = await db.pool.query(submissionQuery, [submissionId, studentId]);

    if (submissionRows.length === 0) {
      throw new Error('Submission not found or you do not have permission to access it.');
    }
    const submission = submissionRows[0];
    if (submission.status !== 'in-progress') {
      throw new Error('This assessment attempt is not currently in progress. It might be completed or aborted.');
    }

    // 2. Fetch questions for the assessment, excluding sensitive answer details
    const questionsQuery = `
      SELECT
        q.id, q.assessment_id, q.question_text, q.question_type, q.points, q.order_in_assessment,
        COALESCE(
          (SELECT json_agg(
            json_build_object('id', ao.id, 'option_text', ao.option_text, 'order_in_question', ao.order_in_question)
           ORDER BY ao.order_in_question ASC)
           FROM AnswerOptions ao
           WHERE ao.question_id = q.id),
          '[]'::json
        ) AS options
        -- Note: We are NOT selecting ao.is_correct or ao.feedback here for student view during attempt
      FROM Questions q
      WHERE q.assessment_id = $1
      ORDER BY q.order_in_assessment ASC;
    `;
    try {
      const { rows: questionRows } = await db.pool.query(questionsQuery, [submission.assessment_id]);
      // TODO: Consider if questions should be shuffled here if assessment.settings.shuffle_questions is true,
      // or if the order_in_assessment should be pre-shuffled when the submission starts.
      // For now, returning based on stored order.
      return questionRows;
    } catch (error) {
      logger.error(`Error fetching questions for submission ${submissionId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Submits answers for a student's active assessment attempt.
   * Can handle one or multiple answers. Uses a transaction for batch submissions.
   * @param {string} submissionId - The ID of the student's submission.
   * @param {string} studentId - The ID of the student.
   * @param {Array<object>} answers - An array of answer objects.
   *        Each object: { questionId, chosenOptionId (for MCQs), answerText (for text answers) }
   * @returns {Promise<Array>} Array of created/updated StudentAnswer objects.
   * @throws {Error} If submission is not valid or answers are invalid.
   */
  async submitStudentAnswers(submissionId, studentId, answers) {
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new Error('Answers must be a non-empty array.');
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify submission belongs to student and is 'in-progress'
      const subQuery = 'SELECT id, assessment_id, status FROM StudentSubmissions WHERE id = $1 AND student_id = $2;';
      const { rows: subRows } = await client.query(subQuery, [submissionId, studentId]);
      if (subRows.length === 0) {
        throw new Error('Submission not found or not owned by student.');
      }
      if (subRows[0].status !== 'in-progress') {
        throw new Error('Assessment attempt is not currently in progress.');
      }
      const assessmentId = subRows[0].assessment_id;

      const savedAnswers = [];
      for (const answer of answers) {
        if (!answer.questionId) {
          throw new Error('Each answer must include a questionId.');
        }

        // 2. Verify question belongs to the assessment of this submission
        const questionQuery = 'SELECT id, question_type FROM Questions WHERE id = $1 AND assessment_id = $2;';
        const { rows: questionRows } = await client.query(questionQuery, [answer.questionId, assessmentId]);
        if (questionRows.length === 0) {
          throw new Error(`Question ${answer.questionId} not found in this assessment.`);
        }
        const questionType = questionRows[0].question_type;

        // 3. Insert or Update the answer (UPSERT)
        // If student re-submits an answer for the same question in the same submission.
        const upsertQuery = `
          INSERT INTO StudentAnswers (submission_id, question_id, chosen_option_id, answer_text, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT (submission_id, question_id)
          DO UPDATE SET
            chosen_option_id = EXCLUDED.chosen_option_id,
            answer_text = EXCLUDED.answer_text,
            updated_at = NOW()
          RETURNING *;
        `;

        let chosenOptionId = answer.chosenOptionId || null;
        let answerText = answer.answerText || null;

        if (questionType.startsWith('multiple-choice') || questionType === 'true-false') {
            if (!chosenOptionId) {
                // Allow unsetting an option by passing null, but if it's the primary mode of answer, it might be required by some validation logic
                // For now, allow null if student wants to clear their choice.
            }
            answerText = null; // Ensure answerText is null for choice-based questions if not also supported
        } else { // short-answer, essay
            chosenOptionId = null; // Ensure chosenOptionId is null for text-based
            if (answerText === null || answerText === undefined) { // Allow empty string for text answers
                 // throw new Error(`Answer text is required for question type ${questionType} (Question ID: ${answer.questionId}).`);
            }
        }

        const values = [submissionId, answer.questionId, chosenOptionId, answerText];
        const { rows: ansRows } = await client.query(upsertQuery, values);
        savedAnswers.push(ansRows[0]);
      }

      await client.query('COMMIT');
      logger.info(`${savedAnswers.length} answer(s) submitted for submission ${submissionId} by student ${studentId}.`);
      return savedAnswers;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error submitting answers for submission ${submissionId}: ${error.message}`, { stack: error.stack, answers });
      if (error.message.includes('not found') || error.message.includes('not owned') || error.message.includes('not currently in progress')) {
        throw error; // Re-throw specific errors for controller
      }
      throw new Error('Failed to submit answers.');
    } finally {
      client.release();
    }
  },

  /**
   * Completes a student's assessment attempt.
   * Updates submission status, completed_at, and time_spent_seconds.
   * Optionally performs basic auto-grading.
   * @param {string} submissionId - The ID of the student's submission.
   * @param {string} studentId - The ID of the student.
   * @returns {Promise<object>} The updated submission object.
   * @throws {Error} If submission is not valid or cannot be completed.
   */
  async completeStudentAssessmentAttempt(submissionId, studentId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify submission, get started_at and assessment_id
      const subCheckQuery = `
        SELECT id, assessment_id, status, started_at
        FROM StudentSubmissions
        WHERE id = $1 AND student_id = $2;
      `;
      const { rows: subRows } = await client.query(subCheckQuery, [submissionId, studentId]);
      if (subRows.length === 0) {
        throw new Error('Submission not found or not owned by student.');
      }
      const submission = subRows[0];
      if (submission.status !== 'in-progress') {
        throw new Error('Assessment attempt is not currently in progress or already completed.');
      }

      const completedAt = new Date();
      const timeSpentSeconds = Math.round((completedAt.getTime() - new Date(submission.started_at).getTime()) / 1000);

      // --- Basic Auto-Grading (Optional Stretch Goal) ---
      let totalAwardedPoints = 0;
      let totalPossiblePoints = 0;

      // Get all questions and their correct answers for this assessment
      const questionsAndAnswersQuery = `
        SELECT
          q.id AS question_id,
          q.points AS question_points,
          q.question_type,
          ao.id AS correct_option_id,
          sa.chosen_option_id AS student_chosen_option_id,
          sa.id AS student_answer_id
        FROM Questions q
        LEFT JOIN AnswerOptions ao ON ao.question_id = q.id AND ao.is_correct = TRUE
        LEFT JOIN StudentAnswers sa ON sa.question_id = q.id AND sa.submission_id = $1
        WHERE q.assessment_id = $2;
      `;
      const { rows: qaRows } = await client.query(questionsAndAnswersQuery, [submissionId, submission.assessment_id]);

      for (const qa of qaRows) {
        totalPossiblePoints += parseFloat(qa.question_points);
        let awardedForThisAnswer = 0;
        let answerIsCorrect = null;

        if (qa.student_answer_id) { // If the student provided an answer for this question
            if (qa.question_type === 'multiple-choice-single' || qa.question_type === 'true-false') {
                if (qa.student_chosen_option_id && qa.student_chosen_option_id === qa.correct_option_id) {
                    awardedForThisAnswer = parseFloat(qa.question_points);
                    answerIsCorrect = true;
                } else {
                    answerIsCorrect = false;
                }
            }
            // Note: 'multiple-choice-multiple', 'short-answer', 'essay' require manual grading or more complex logic.
            // For this basic auto-grading, they will score 0 unless manually updated later.

            const updateStudentAnswerQuery = `
              UPDATE StudentAnswers
              SET awarded_points = $1, is_correct = $2, updated_at = NOW()
              WHERE id = $3;
            `;
            await client.query(updateStudentAnswerQuery, [awardedForThisAnswer, answerIsCorrect, qa.student_answer_id]);
            totalAwardedPoints += awardedForThisAnswer;
        }
      }

      const percentageScore = totalPossiblePoints > 0 ? (totalAwardedPoints / totalPossiblePoints) * 100 : 0;

      // Fetch passing score percentage from Assessment
      const assessmentDetailsQuery = 'SELECT passing_score_percentage FROM Assessments WHERE id = $1;';
      const {rows: assessmentRows} = await client.query(assessmentDetailsQuery, [submission.assessment_id]);
      const passingScorePercentage = assessmentRows[0]?.passing_score_percentage;
      const isPassing = passingScorePercentage !== null ? percentageScore >= parseFloat(passingScorePercentage) : null;

      // 2. Update submission status, completed_at, time_spent, score
      const updateSubmissionQuery = `
        UPDATE StudentSubmissions
        SET
          status = 'completed',
          completed_at = $1,
          time_spent_seconds = $2,
          score = $3,
          percentage_score = $4,
          is_passing = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *;
      `;
      const { rows: updatedSubRows } = await client.query(updateSubmissionQuery, [
        completedAt,
        timeSpentSeconds,
        totalAwardedPoints,
        percentageScore.toFixed(2),
        isPassing,
        submissionId
      ]);

      await client.query('COMMIT');
      logger.info(`Submission ${submissionId} completed by student ${studentId}. Auto-graded score: ${totalAwardedPoints}/${totalPossiblePoints}`);
      return updatedSubRows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error completing assessment attempt ${submissionId}: ${error.message}`, { stack: error.stack });
      if (error.message.includes('not found') || error.message.includes('not owned') || error.message.includes('not currently in progress')) {
        throw error;
      }
      throw new Error('Failed to complete assessment attempt.');
    } finally {
      client.release();
    }
  },

  /**
   * Fetches a list of all submissions for a given student, with optional filters.
   * @param {string} studentId - The ID of the student.
   * @param {object} [filters={}] - Optional filters (e.g., { course_id: 'uuid', assessment_id: 'uuid' })
   * @returns {Promise<Array>} An array of submission summary objects.
   */
  async getMySubmissions(studentId, filters = {}) {
    let query = `
      SELECT
        ss.id as submission_id,
        ss.assessment_id,
        a.title as assessment_title,
        a.course_id,
        ss.status,
        ss.score,
        ss.percentage_score,
        ss.is_passing,
        ss.attempt_number,
        ss.started_at,
        ss.completed_at,
        ss.graded_at
      FROM StudentSubmissions ss
      JOIN Assessments a ON ss.assessment_id = a.id
      WHERE ss.student_id = $1
    `;
    const values = [studentId];
    const conditions = [];

    if (filters.course_id) {
      values.push(filters.course_id);
      conditions.push(`a.course_id = $${values.length}`);
    }
    if (filters.assessment_id) {
      values.push(filters.assessment_id);
      conditions.push(`ss.assessment_id = $${values.length}`);
    }
    // Add more filters as needed (e.g., status)

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }
    query += ' ORDER BY ss.started_at DESC;';

    try {
      const { rows } = await db.pool.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`Error fetching submissions for student ${studentId}: ${error.message}`, { stack: error.stack, filters });
      throw error;
    }
  },

  /**
   * Fetches detailed results for a specific, completed/graded submission owned by the student.
   * Includes questions, student's answers, awarded points, and potentially correct answers based on assessment settings.
   * @param {string} submissionId - The ID of the student's submission.
   * @param {string} studentId - The ID of the student.
   * @returns {Promise<object|null>} The detailed submission results or null if not found/accessible.
   * @throws {Error} If submission is not completed/graded or access is denied.
   */
  async getStudentSubmissionResults(submissionId, studentId) {
    // 1. Fetch submission and assessment details (including settings for revealing answers)
    const submissionQuery = `
      SELECT
        ss.id as submission_id, ss.student_id, ss.assessment_id, ss.status, ss.score,
        ss.percentage_score, ss.is_passing, ss.attempt_number,
        ss.started_at, ss.completed_at, ss.graded_at, ss.time_spent_seconds, ss.overall_feedback,
        a.title AS assessment_title, a.passing_score_percentage AS assessment_passing_score,
        a.settings AS assessment_settings -- Contains reveal_correct_answers etc.
      FROM StudentSubmissions ss
      JOIN Assessments a ON ss.assessment_id = a.id
      WHERE ss.id = $1 AND ss.student_id = $2;
    `;
    const { rows: submissionRows } = await db.pool.query(submissionQuery, [submissionId, studentId]);

    if (submissionRows.length === 0) {
      throw new Error('Submission not found or you do not have permission to access it.');
    }
    const submissionDetails = submissionRows[0];

    if (!['completed', 'graded'].includes(submissionDetails.status)) {
      throw new Error('Submission results are not yet available. The assessment attempt is not completed or graded.');
    }

    const revealSettings = submissionDetails.assessment_settings || {};
    // Example: reveal_correct_answers can be 'never', 'after_submission', 'after_grading'
    // For simplicity, we'll assume 'after_grading' means if status is 'graded', and 'after_submission' if status is 'completed' or 'graded'.
    // A more robust solution would also check dates if 'after_due_date' was an option.
    let canRevealCorrectAnswers = false;
    if (revealSettings.reveal_correct_answers === 'after_grading' && submissionDetails.status === 'graded') {
        canRevealCorrectAnswers = true;
    } else if (revealSettings.reveal_correct_answers === 'after_submission' && ['completed', 'graded'].includes(submissionDetails.status)) {
        canRevealCorrectAnswers = true;
    }
    // Add other conditions like date checks if necessary

    // 2. Fetch student's answers along with question details
    // Conditionally include correct answer information based on canRevealCorrectAnswers
    let answersQuery = `
      SELECT
        sa.id AS student_answer_id, sa.question_id, sa.chosen_option_id, sa.answer_text,
        sa.awarded_points, sa.is_correct AS student_answer_is_correct, sa.grader_feedback,
        q.question_text, q.question_type, q.points AS question_max_points,
        q.feedback_general AS question_feedback_general,
        q.feedback_correct AS question_feedback_correct, -- Shown if student got it right & settings allow
        q.feedback_incorrect AS question_feedback_incorrect, -- Shown if student got it wrong & settings allow
    `;

    if (canRevealCorrectAnswers) {
      answersQuery += `
        -- All options for the question, including which ones are correct
        (SELECT json_agg(
            json_build_object('id', ao.id, 'option_text', ao.option_text, 'is_correct', ao.is_correct, 'feedback', ao.feedback)
            ORDER BY ao.order_in_question ASC
          )
         FROM AnswerOptions ao
         WHERE ao.question_id = q.id) AS all_question_options
      `;
    } else {
      answersQuery += `
        -- Only the student's chosen option text if multiple choice, or limited info
        (SELECT json_agg(
            json_build_object('id', ao.id, 'option_text', ao.option_text)
            ORDER BY ao.order_in_question ASC
          )
         FROM AnswerOptions ao
         WHERE ao.question_id = q.id
           AND (sa.chosen_option_id = ao.id OR q.question_type NOT LIKE 'multiple-choice%')
           -- The above condition is tricky. We might just want to show all options without marking correct,
           -- or only the chosen one. Let's show all options but without is_correct if not revealing.
        ) AS all_question_options_student_view
        -- Simplified: just show all options without is_correct flag if not revealing fully
        -- (SELECT json_agg(json_build_object('id', ao.id, 'option_text', ao.option_text) ORDER BY ao.order_in_question ASC)
        --  FROM AnswerOptions ao WHERE ao.question_id = q.id) AS all_question_options_student_view
      `;
       // Simpler: Let's refine to show all options but without is_correct if canRevealCorrectAnswers is false.
      // This was getting too complex. The SELECT below will be simplified.
    }

    // Refined answersQuery for simplicity based on canRevealCorrectAnswers logic
    answersQuery = `
      SELECT
        sa.id AS student_answer_id, sa.question_id, sa.chosen_option_id, sa.answer_text,
        sa.awarded_points, sa.is_correct AS student_answer_is_correct, sa.grader_feedback,
        q.question_text, q.question_type, q.points AS question_max_points,
        q.feedback_general AS question_feedback_general,
        CASE
            WHEN sa.is_correct = TRUE THEN q.feedback_correct
            WHEN sa.is_correct = FALSE THEN q.feedback_incorrect
            ELSE NULL
        END as question_specific_outcome_feedback,
        (SELECT
            json_agg(
                json_build_object('id', ao.id, 'option_text', ao.option_text ${canRevealCorrectAnswers ? ", 'is_correct', ao.is_correct, 'feedback', ao.feedback" : ""})
                ORDER BY ao.order_in_question ASC
            )
         FROM AnswerOptions ao
         WHERE ao.question_id = q.id) AS question_options
      FROM StudentAnswers sa
      JOIN Questions q ON sa.question_id = q.id
      WHERE sa.submission_id = $1
      ORDER BY q.order_in_assessment ASC;
    `;

    try {
      const { rows: answerRows } = await db.pool.query(answersQuery, [submissionId]);
      submissionDetails.answers = answerRows;
      submissionDetails.assessment_settings.can_reveal_correct_answers = canRevealCorrectAnswers; // Inform client

      return submissionDetails;
    } catch (error) {
      logger.error(`Error fetching student submission results for submission ${submissionId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
};

module.exports = StudentAssessmentService;
