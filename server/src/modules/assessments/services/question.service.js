// server/src/modules/assessments/services/question.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const QuestionService = {
  /**
   * Add a new question to an assessment, including its answer options.
   * Uses a transaction to ensure atomicity.
   * @param {string} assessmentId - The ID of the assessment.
   * @param {object} questionData - Data for the new question.
   * @param {string} questionData.question_text - Text of the question.
   * @param {string} questionData.question_type - Type of the question.
   * @param {number} [questionData.points=1.00] - Points for the question.
   * @param {number} [questionData.order_in_assessment=0] - Order of the question.
   * @param {string} [questionData.feedback_general] - General feedback.
   * @param {Array<object>} [questionData.options=[]] - Array of answer options.
   * @param {string} option.option_text - Text of the option.
   * @param {boolean} [option.is_correct=false] - Whether the option is correct.
   * @param {number} [option.order_in_question=0] - Order of the option.
   * @returns {Promise<object>} The created question object with options.
   */
  async addQuestionToAssessment(assessmentId, questionData) {
    const {
      question_text,
      question_type,
      points = 1.00,
      order_in_assessment = 0,
      feedback_general,
      feedback_correct,
      feedback_incorrect,
      options = [], // Array of answer options
    } = questionData;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const questionQuery = `
        INSERT INTO Questions 
          (assessment_id, question_text, question_type, points, order_in_assessment, feedback_general, feedback_correct, feedback_incorrect)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;
      const questionValues = [
        assessmentId,
        question_text,
        question_type,
        points,
        order_in_assessment,
        feedback_general,
        feedback_correct,
        feedback_incorrect,
      ];
      const { rows: questionRows } = await client.query(questionQuery, questionValues);
      const newQuestion = questionRows[0];

      const createdOptions = [];
      if (['multiple-choice-single', 'multiple-choice-multiple', 'true-false'].includes(question_type) && options.length > 0) {
        for (const opt of options) {
          const optionQuery = `
            INSERT INTO AnswerOptions
              (question_id, option_text, is_correct, order_in_question, feedback)
            VALUES
              ($1, $2, $3, $4, $5)
            RETURNING *;
          `;
          const optionValues = [newQuestion.id, opt.option_text, opt.is_correct || false, opt.order_in_question || 0, opt.feedback];
          const { rows: optionRows } = await client.query(optionQuery, optionValues);
          createdOptions.push(optionRows[0]);
        }
      }
      newQuestion.options = createdOptions;

      await client.query('COMMIT');
      logger.info(`Question ${newQuestion.id} and its options added to assessment ${assessmentId}.`);
      return newQuestion;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error adding question to assessment ${assessmentId}: ${error.message}`, { stack: error.stack, data: questionData });
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Find all questions for a specific assessment, including their options.
   * @param {string} assessmentId - The ID of the assessment.
   * @returns {Promise<Array>} An array of question objects with their options.
   */
  async findQuestionsByAssessmentId(assessmentId) {
    // This query fetches questions and aggregates their options into a JSON array.
    const query = `
      SELECT 
        q.*, 
        COALESCE(
          (SELECT json_agg(ao.* ORDER BY ao.order_in_question ASC) 
           FROM AnswerOptions ao 
           WHERE ao.question_id = q.id), 
          '[]'::json
        ) AS options
      FROM Questions q
      WHERE q.assessment_id = $1
      ORDER BY q.order_in_assessment ASC;
    `;
    try {
      const { rows } = await db.pool.query(query, [assessmentId]);
      return rows;
    } catch (error) {
      logger.error(`Error finding questions for assessment ${assessmentId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Find a specific question by its ID, including its answer options.
   * @param {string} questionId - The ID of the question.
   * @returns {Promise<object|null>} The question object with options or null if not found.
   */
  async findQuestionById(questionId) {
    const query = `
      SELECT 
        q.*, 
        COALESCE(
          (SELECT json_agg(ao.* ORDER BY ao.order_in_question ASC) 
           FROM AnswerOptions ao 
           WHERE ao.question_id = q.id), 
          '[]'::json
        ) AS options
      FROM Questions q
      WHERE q.id = $1;
    `;
    try {
      const { rows } = await db.pool.query(query, [questionId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding question by ID ${questionId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Update a question and its answer options.
   * Options are fully replaced: existing options for the question are deleted, then new ones are inserted.
   * Uses a transaction.
   * @param {string} questionId - The ID of the question to update.
   * @param {object} updates - An object containing the fields to update for the question.
   * @param {Array<object>} [updates.options=[]] - Array of new answer options.
   * @returns {Promise<object|null>} The updated question object with options or null if not found.
   */
  async updateQuestion(questionId, updates) {
    const {
      question_text,
      question_type,
      points,
      order_in_assessment,
      feedback_general,
      feedback_correct,
      feedback_incorrect,
      options = [], // Assume options are part of the updates object
    } = updates;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Update Question details
      const questionUpdateFields = [];
      const questionUpdateValues = [];
      let qParamCount = 1;

      if (question_text !== undefined) { questionUpdateFields.push(`question_text = $${qParamCount++}`); questionUpdateValues.push(question_text); }
      if (question_type !== undefined) { questionUpdateFields.push(`question_type = $${qParamCount++}`); questionUpdateValues.push(question_type); }
      if (points !== undefined) { questionUpdateFields.push(`points = $${qParamCount++}`); questionUpdateValues.push(points); }
      if (order_in_assessment !== undefined) { questionUpdateFields.push(`order_in_assessment = $${qParamCount++}`); questionUpdateValues.push(order_in_assessment); }
      if (feedback_general !== undefined) { questionUpdateFields.push(`feedback_general = $${qParamCount++}`); questionUpdateValues.push(feedback_general); }
      if (feedback_correct !== undefined) { questionUpdateFields.push(`feedback_correct = $${qParamCount++}`); questionUpdateValues.push(feedback_correct); }
      if (feedback_incorrect !== undefined) { questionUpdateFields.push(`feedback_incorrect = $${qParamCount++}`); questionUpdateValues.push(feedback_incorrect); }
      
      let updatedQuestion = null;
      if (questionUpdateFields.length > 0) {
        questionUpdateValues.push(questionId);
        const updateQuestionQuery = `
          UPDATE Questions 
          SET ${questionUpdateFields.join(', ')}
          WHERE id = $${qParamCount}
          RETURNING *;
        `;
        const { rows: updatedQuestionRows } = await client.query(updateQuestionQuery, questionUpdateValues);
        if (updatedQuestionRows.length === 0) {
          await client.query('ROLLBACK');
          client.release();
          return null; // Question not found
        }
        updatedQuestion = updatedQuestionRows[0];
      } else {
        // If no question fields to update, fetch the current question to attach updated options to
        const { rows: currentQuestionRows } = await client.query('SELECT * FROM Questions WHERE id = $1', [questionId]);
         if (currentQuestionRows.length === 0) {
          await client.query('ROLLBACK');
          client.release();
          return null; // Question not found
        }
        updatedQuestion = currentQuestionRows[0];
      }
      
      // Delete existing options for this question
      await client.query('DELETE FROM AnswerOptions WHERE question_id = $1;', [questionId]);

      // Insert new options if provided
      const createdOptions = [];
      if (['multiple-choice-single', 'multiple-choice-multiple', 'true-false'].includes(updatedQuestion.question_type) && options.length > 0) {
        for (const opt of options) {
          const insertOptionQuery = `
            INSERT INTO AnswerOptions (question_id, option_text, is_correct, order_in_question, feedback)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
          `;
          const optionValues = [questionId, opt.option_text, opt.is_correct || false, opt.order_in_question || 0, opt.feedback];
          const { rows: optionRows } = await client.query(insertOptionQuery, optionValues);
          createdOptions.push(optionRows[0]);
        }
      }
      updatedQuestion.options = createdOptions;

      await client.query('COMMIT');
      logger.info(`Question ${questionId} and its options updated successfully.`);
      return updatedQuestion;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating question ${questionId}: ${error.message}`, { stack: error.stack, updates });
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Delete a question by its ID. Associated answer options will be deleted by CASCADE constraint.
   * @param {string} questionId - The ID of the question to delete.
   * @returns {Promise<object|null>} The deleted question object or null if not found.
   */
  async removeQuestion(questionId) {
    const query = 'DELETE FROM Questions WHERE id = $1 RETURNING *;';
    try {
      const { rows } = await db.pool.query(query, [questionId]);
      if (rows.length === 0) return null; // Not found
      logger.info(`Question ${questionId} deleted successfully.`);
      return rows[0]; // AnswerOptions are deleted via CASCADE
    } catch (error) {
      logger.error(`Error deleting question ${questionId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },
};

module.exports = QuestionService;
