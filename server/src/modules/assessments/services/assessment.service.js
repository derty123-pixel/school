// server/src/modules/assessments/services/assessment.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const AssessmentService = {
  /**
   * Create a new assessment.
   * @param {object} assessmentData - Data for the new assessment.
   * @param {string} assessmentData.course_id - ID of the course.
   * @param {string} assessmentData.title - Title of the assessment.
   * @param {string} [assessmentData.description] - Description of the assessment.
   * @param {number} [assessmentData.time_limit_minutes] - Time limit in minutes.
   * @param {number} [assessmentData.passing_score_percentage] - Passing score percentage.
   * @param {string} [assessmentData.status='draft'] - Status (e.g., 'draft', 'published').
   * @param {object} [assessmentData.settings] - JSONB settings object.
   * @param {string} userId - ID of the user creating the assessment.
   * @returns {Promise<object>} The created assessment object.
   */
  async create(assessmentData, userId) {
    const {
      course_id,
      title,
      description,
      time_limit_minutes,
      passing_score_percentage,
      status = 'draft',
      settings = {}, // Default to empty object if not provided
    } = assessmentData;

    const query = `
      INSERT INTO Assessments 
        (course_id, title, description, time_limit_minutes, passing_score_percentage, status, settings, created_by, updated_by)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      course_id,
      title,
      description,
      time_limit_minutes,
      passing_score_percentage,
      status,
      settings,
      userId,
      userId,
    ];

    try {
      const { rows } = await db.pool.query(query, values);
      logger.info(`Assessment created successfully by user ${userId}: ${rows[0].id}`);
      return rows[0];
    } catch (error) {
      logger.error(`Error creating assessment by user ${userId}: ${error.message}`, { stack: error.stack, data: assessmentData });
      throw error;
    }
  },

  /**
   * Find all assessments.
   * @param {object} [filters={}] - Optional filters (e.g., { course_id: 'uuid' })
   * @returns {Promise<Array>} An array of assessment objects.
   */
  async findAll(filters = {}) {
    let query = 'SELECT * FROM Assessments';
    const values = [];
    const conditions = [];

    if (filters.course_id) {
      values.push(filters.course_id);
      conditions.push(`course_id = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`status = $${values.length}`);
    }
    // Add more filters as needed

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC;'; // Default ordering

    try {
      const { rows } = await db.pool.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`Error finding all assessments: ${error.message}`, { stack: error.stack, filters });
      throw error;
    }
  },

  /**
   * Find an assessment by its ID.
   * @param {string} assessmentId - The ID of the assessment.
   * @returns {Promise<object|null>} The assessment object or null if not found.
   */
  async findById(assessmentId) {
    const query = 'SELECT * FROM Assessments WHERE id = $1;';
    try {
      const { rows } = await db.pool.query(query, [assessmentId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding assessment by ID ${assessmentId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Update an assessment.
   * @param {string} assessmentId - The ID of the assessment to update.
   * @param {object} updates - An object containing the fields to update.
   * @param {string} userId - ID of the user performing the update.
   * @returns {Promise<object|null>} The updated assessment object or null if not found.
   */
  async update(assessmentId, updates, userId) {
    // Destructure allowed fields for update to prevent unwanted updates
    const { title, description, time_limit_minutes, passing_score_percentage, status, settings } = updates;
    
    // Build the query dynamically based on provided updates
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { fields.push(`title = $${paramCount++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${paramCount++}`); values.push(description); }
    if (time_limit_minutes !== undefined) { fields.push(`time_limit_minutes = $${paramCount++}`); values.push(time_limit_minutes); }
    if (passing_score_percentage !== undefined) { fields.push(`passing_score_percentage = $${paramCount++}`); values.push(passing_score_percentage); }
    if (status !== undefined) { fields.push(`status = $${paramCount++}`); values.push(status); }
    if (settings !== undefined) { fields.push(`settings = $${paramCount++}`); values.push(settings); }
    
    if (fields.length === 0) {
      // No fields to update, just fetch the current record or throw error
      logger.warn(`No fields to update for assessment ${assessmentId} by user ${userId}.`);
      return this.findById(assessmentId); // Or throw new Error('No update fields provided');
    }

    fields.push(`updated_by = $${paramCount++}`);
    values.push(userId);
    // updated_at is handled by the database trigger

    values.push(assessmentId); // For the WHERE clause

    const query = `
      UPDATE Assessments 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *;
    `;

    try {
      const { rows } = await db.pool.query(query, values);
      if (rows.length === 0) return null; // Not found
      logger.info(`Assessment ${assessmentId} updated successfully by user ${userId}.`);
      return rows[0];
    } catch (error) {
      logger.error(`Error updating assessment ${assessmentId} by user ${userId}: ${error.message}`, { stack: error.stack, updates });
      throw error;
    }
  },

  /**
   * Delete an assessment by its ID.
   * @param {string} assessmentId - The ID of the assessment to delete.
   * @returns {Promise<object|null>} The deleted assessment object or null if not found.
   */
  async remove(assessmentId) {
    const query = 'DELETE FROM Assessments WHERE id = $1 RETURNING *;';
    try {
      const { rows } = await db.pool.query(query, [assessmentId]);
      if (rows.length === 0) return null; // Not found
      logger.info(`Assessment ${assessmentId} deleted successfully.`);
      return rows[0];
    } catch (error) {
      logger.error(`Error deleting assessment ${assessmentId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Get all student submissions for a specific assessment.
   * Includes basic student info, status, score, and submission dates.
   * @param {string} assessmentId - The ID of the assessment.
   * @returns {Promise<Array>} An array of submission summary objects.
   */
  async getSubmissionsForAssessment(assessmentId) {
    // This query assumes a Users table exists with at least id, firstName, lastName, email
    // Adjust JOIN and selected fields if your Users table is different.
    const query = `
      SELECT 
        ss.id as submission_id,
        ss.student_id,
        u.first_name || ' ' || u.last_name AS student_name, -- Concatenate names
        u.email AS student_email,
        ss.status,
        ss.score,
        ss.percentage_score,
        ss.is_passing,
        ss.attempt_number,
        ss.started_at,
        ss.completed_at,
        ss.graded_at
      FROM StudentSubmissions ss
      JOIN Users u ON ss.student_id = u.id 
      WHERE ss.assessment_id = $1
      ORDER BY ss.started_at DESC;
    `;
    try {
      const { rows } = await db.pool.query(query, [assessmentId]);
      return rows;
    } catch (error) {
      logger.error(`Error fetching submissions for assessment ${assessmentId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Get detailed information for a single student submission.
   * Includes all student answers, question text, chosen options, correct options (for instructor review),
   * auto-graded scores, and any existing manual grades/feedback.
   * @param {string} submissionId - The ID of the student submission.
   * @returns {Promise<object|null>} The detailed submission object or null if not found.
   */
  async getDetailedSubmission(submissionId) {
    // This is a more complex query to gather all necessary details for review/grading.
    const submissionQuery = `
      SELECT 
        ss.id as submission_id, ss.student_id, ss.assessment_id, ss.status, ss.score, 
        ss.percentage_score, ss.is_passing, ss.attempt_number,
        ss.started_at, ss.completed_at, ss.graded_at, ss.time_spent_seconds,
        a.title AS assessment_title, a.passing_score_percentage AS assessment_passing_score,
        u.first_name || ' ' || u.last_name AS student_name, u.email AS student_email
      FROM StudentSubmissions ss
      JOIN Assessments a ON ss.assessment_id = a.id
      JOIN Users u ON ss.student_id = u.id
      WHERE ss.id = $1;
    `;

    const answersQuery = `
      SELECT 
        sa.id AS student_answer_id, sa.question_id, sa.chosen_option_id, sa.answer_text, 
        sa.awarded_points, sa.is_correct AS student_answer_is_correct,
        q.question_text, q.question_type, q.points AS question_max_points, 
        q.feedback_general, q.feedback_correct AS question_feedback_correct, q.feedback_incorrect AS question_feedback_incorrect,
        -- Aggregate correct answer options for display to grader
        (SELECT json_agg(json_build_object('id', cao.id, 'option_text', cao.option_text)) 
         FROM AnswerOptions cao 
         WHERE cao.question_id = q.id AND cao.is_correct = TRUE) AS correct_options,
        -- Aggregate all options for the question for display
        (SELECT json_agg(json_build_object('id', ao.id, 'option_text', ao.option_text, 'is_correct', ao.is_correct, 'feedback', ao.feedback) ORDER BY ao.order_in_question ASC)
         FROM AnswerOptions ao
         WHERE ao.question_id = q.id) AS all_question_options
      FROM StudentAnswers sa
      JOIN Questions q ON sa.question_id = q.id
      WHERE sa.submission_id = $1
      ORDER BY q.order_in_assessment ASC;
    `;
    
    const client = await db.pool.connect();
    try {
      const { rows: submissionRows } = await client.query(submissionQuery, [submissionId]);
      if (submissionRows.length === 0) {
        return null; // Submission not found
      }
      const submissionDetails = submissionRows[0];

      const { rows: answerRows } = await client.query(answersQuery, [submissionId]);
      submissionDetails.answers = answerRows;
      
      return submissionDetails;
    } catch (error) {
      logger.error(`Error fetching detailed submission ${submissionId}: ${error.message}`, { stack: error.stack });
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Manually grade or update a specific student's answer.
   * Recalculates the total score for the StudentSubmission.
   * @param {string} studentAnswerId - The ID of the StudentAnswers record.
   * @param {number} awardedPoints - Points to award for this answer.
   * @param {string} [graderFeedback] - Optional feedback from the grader.
   * @param {string} adminUserId - ID of the admin/instructor performing the grading.
   * @returns {Promise<object>} The updated StudentSubmission object.
   * @throws {Error} If answer not found or update fails.
   */
  async gradeStudentAnswer(studentAnswerId, awardedPoints, graderFeedback, adminUserId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update the specific student answer
      const updateAnswerQuery = `
        UPDATE StudentAnswers 
        SET 
          awarded_points = $1, 
          -- is_correct might be manually set or derived based on points vs max_points for the question
          -- For simplicity, if points > 0, consider it 'correct-ish' or leave as is from auto-grade
          -- is_correct = ($1 > 0), -- This is a simplification, might need more nuance
          grader_feedback = $2, -- Assuming a new column or repurposing existing feedback
          updated_at = NOW()
        WHERE id = $3
        RETURNING submission_id, question_id;
      `;
      // Note: `is_correct` update logic here is basic. A more robust system might compare awarded_points to question.points.
      const { rows: updatedAnswerRows } = await client.query(updateAnswerQuery, [awardedPoints, graderFeedback, studentAnswerId]);
      if (updatedAnswerRows.length === 0) {
        throw new Error('Student answer not found.');
      }
      const { submission_id: submissionId, question_id: questionId } = updatedAnswerRows[0];

      // (Optional) Update is_correct based on points awarded vs question's max points
      const questionPointsQuery = 'SELECT points FROM Questions WHERE id = $1;';
      const { rows: questionRows } = await client.query(questionPointsQuery, [questionId]);
      if (questionRows.length > 0) {
        const maxPointsForQuestion = parseFloat(questionRows[0].points);
        const isCorrectManual = parseFloat(awardedPoints) >= maxPointsForQuestion; // Full points = correct
        await client.query('UPDATE StudentAnswers SET is_correct = $1 WHERE id = $2', [isCorrectManual, studentAnswerId]);
      }

      // 2. Recalculate total score for the submission
      const sumScoresQuery = `
        SELECT COALESCE(SUM(awarded_points), 0) as current_total_score 
        FROM StudentAnswers 
        WHERE submission_id = $1;
      `;
      const { rows: sumRows } = await client.query(sumScoresQuery, [submissionId]);
      const newTotalScore = parseFloat(sumRows[0].current_total_score);

      // 3. Get total possible points for the assessment to calculate percentage
      const assessmentInfoQuery = `
        SELECT 
          a.id as assessment_id, 
          a.passing_score_percentage,
          SUM(q.points) as total_possible_points
        FROM Assessments a
        JOIN StudentSubmissions ss ON ss.assessment_id = a.id
        JOIN Questions q ON q.assessment_id = a.id
        WHERE ss.id = $1
        GROUP BY a.id, a.passing_score_percentage;
      `;
      const { rows: assessmentInfoRows } = await client.query(assessmentInfoQuery, [submissionId]);
      if (assessmentInfoRows.length === 0) {
        throw new Error('Could not retrieve assessment details for score recalculation.');
      }
      const assessmentInfo = assessmentInfoRows[0];
      const totalPossiblePoints = parseFloat(assessmentInfo.total_possible_points);
      const passingScorePercentage = assessmentInfo.passing_score_percentage ? parseFloat(assessmentInfo.passing_score_percentage) : null;
      
      const percentageScore = totalPossiblePoints > 0 ? (newTotalScore / totalPossiblePoints) * 100 : 0;
      const isPassing = passingScorePercentage !== null ? percentageScore >= passingScorePercentage : null;

      // 4. Update the StudentSubmissions table
      const updateSubmissionQuery = `
        UPDATE StudentSubmissions 
        SET 
          score = $1, 
          percentage_score = $2,
          is_passing = $3,
          status = 'graded', -- Mark as graded if not already, or keep current if only partial grading
          graded_at = NOW(),
          graded_by = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *;
      `;
      const { rows: updatedSubmissionRows } = await client.query(updateSubmissionQuery, [
        newTotalScore.toFixed(2),
        percentageScore.toFixed(2),
        isPassing,
        adminUserId,
        submissionId
      ]);
      
      await client.query('COMMIT');
      logger.info(`Answer ${studentAnswerId} in submission ${submissionId} graded by ${adminUserId}. New score: ${newTotalScore}.`);
      return updatedSubmissionRows[0]; // Return the updated submission
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error grading student answer ${studentAnswerId} by ${adminUserId}: ${error.message}`, { stack: error.stack });
      throw error;
    } finally {
      client.release();
    }
  },
  
  // Placeholder for addOverallSubmissionFeedback - could update a new 'overall_feedback' text column in StudentSubmissions
  async addOverallSubmissionFeedback(submissionId, feedback, adminUserId) {
    const query = `
      UPDATE StudentSubmissions
      SET overall_feedback = $1, updated_at = NOW(), graded_by = $2, graded_at = NOW() 
      WHERE id = $3
      RETURNING *;
    `;
    // Ensure 'overall_feedback' column exists or add it.
    // Also consider if this should change the 'status' to 'graded'.
    try {
      const { rows } = await db.pool.query(query, [feedback, adminUserId, submissionId]);
      if (rows.length === 0) throw new Error('Submission not found.');
      logger.info(`Overall feedback added to submission ${submissionId} by ${adminUserId}.`);
      return rows[0];
    } catch (error) {
      logger.error(`Error adding overall feedback to submission ${submissionId}: ${error.message}`, {stack: error.stack});
      throw error;
    }
  }

};

module.exports = AssessmentService;
