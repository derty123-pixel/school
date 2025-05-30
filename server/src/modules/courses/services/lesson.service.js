// server/src/modules/courses/services/lesson.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const LessonService = {
  /**
   * Updates a lesson, primarily with video details.
   * Can also update other lesson fields like title, description, content_type.
   * @param {string} lessonId - The ID of the lesson to update.
   * @param {object} lessonData - Data for updating the lesson.
   *        Includes fields like title, description, content_type,
   *        and video-specific fields: video_provider, external_video_id, video_title_override,
   *        video_description_override, thumbnail_url, is_preview_allowed, video_duration_seconds.
   * @param {string} adminUserId - ID of the admin/instructor performing the update.
   * @returns {Promise<object|null>} The updated lesson object or null if not found.
   */
  async updateLessonDetails(lessonId, lessonData, adminUserId) {
    const {
      title,
      description,
      order_in_course,
      content_type,
      text_content, // If updating text content
      video_provider,
      external_video_id,
      video_duration_seconds,
      video_title_override,
      video_description_override,
      thumbnail_url,
      is_preview_allowed,
    } = lessonData;

    // --- Conceptual: Fetch additional metadata from video provider ---
    // This would typically happen if video_provider and external_video_id are newly set or changed.
    let fetchedProviderMetadata = {};
    if (content_type === 'video' && video_provider && external_video_id) {
      logger.info(`[Conceptual] Lesson ${lessonId}: If provider API integration were live, would attempt to fetch metadata for provider '${video_provider}', video ID '${external_video_id}'.`);
      // Example of what might be fetched and merged:
      // fetchedProviderMetadata.video_duration_seconds = 1234; // from provider
      // fetchedProviderMetadata.thumbnail_url = 'https://provider.com/thumb.jpg'; // from provider
      // fetchedProviderMetadata.provider_native_title = 'Video Title From Provider'; // from provider
      //
      // This fetched metadata would then be intelligently merged with lessonData.
      // For example, use lessonData.video_duration_seconds if provided, else use fetched.
      // For this task, we just log the conceptual step.
    }
    // --- End Conceptual Fetch ---

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Helper to add field to update query
    const addField = (field, value) => {
      if (value !== undefined) {
        updateFields.push(`${field} = $${paramCount++}`);
        values.push(value);
      }
    };

    addField('title', title);
    addField('description', description);
    addField('order_in_course', order_in_course);
    addField('content_type', content_type);

    if (content_type === 'text') {
      addField('text_content', text_content);
      // Nullify video fields if changing to text
      updateFields.push(`video_provider = NULL, external_video_id = NULL, video_duration_seconds = NULL, video_title_override = NULL, video_description_override = NULL, thumbnail_url = NULL`);
    } else if (content_type === 'video') {
      addField('video_provider', video_provider);
      addField('external_video_id', external_video_id);
      addField('video_duration_seconds', video_duration_seconds !== undefined ? video_duration_seconds : fetchedProviderMetadata.video_duration_seconds);
      addField('video_title_override', video_title_override);
      addField('video_description_override', video_description_override);
      addField('thumbnail_url', thumbnail_url !== undefined ? thumbnail_url : fetchedProviderMetadata.thumbnail_url);
      addField('is_preview_allowed', is_preview_allowed);
      // Nullify text_content if changing to video
      updateFields.push(`text_content = NULL`);
    } else {
        // For other content types, nullify both text and video specific fields
        updateFields.push(`text_content = NULL, video_provider = NULL, external_video_id = NULL, video_duration_seconds = NULL, video_title_override = NULL, video_description_override = NULL, thumbnail_url = NULL`);
    }

    // updated_at is handled by trigger, updated_by could be added if schema supports it for lessons
    // For now, assuming updated_by is not on Lessons table, but logging adminUserId

    if (updateFields.length === 0) {
      logger.warn(`No updatable fields provided for lesson ${lessonId}.`);
      // Optionally fetch and return the current lesson data
      const currentLesson = await this.findLessonById(lessonId); // Assuming findLessonById exists
      return currentLesson;
    }

    values.push(lessonId); // For WHERE clause

    const query = `
      UPDATE Lessons
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *;
    `;

    try {
      const { rows } = await db.pool.query(query, values);
      if (rows.length === 0) {
        return null; // Lesson not found
      }
      logger.info(`Lesson ${lessonId} details updated by admin ${adminUserId}.`);
      return rows[0];
    } catch (error) {
      logger.error(`Error updating lesson ${lessonId}: ${error.message}`, { stack: error.stack, data: lessonData });
      if (error.constraint) { // Handle specific DB errors like check violations
        throw new Error(`Failed to update lesson due to constraint: ${error.constraint}. Ensure all required fields for content type '${content_type}' are provided.`);
      }
      throw error;
    }
  },

  /**
   * Placeholder for finding a lesson by ID (needed for update if no fields changed).
   * @param {string} lessonId
   * @returns {Promise<object|null>}
   */
  async findLessonById(lessonId) {
    const query = 'SELECT * FROM Lessons WHERE id = $1;';
    try {
      const { rows } = await db.pool.query(query, [lessonId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding lesson by ID ${lessonId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  // Placeholder for createLesson - not focus of this task but would be in this service
  async createLesson(courseId, lessonData, adminUserId) {
    // ... implementation for creating a new lesson ...
    logger.info(`Lesson created for course ${courseId} by ${adminUserId}.`);
    // Dummy return for now
    return { id: 'new-lesson-uuid', course_id: courseId, ...lessonData };
  },

  /**
   * Get secure video playback details for a lesson for an authorized student.
   * @param {string} lessonId - The ID of the lesson.
   * @param {string} studentId - The ID of the student requesting access.
   * @returns {Promise<object|null>} Playback details or null if lesson/video not found.
   * @throws {Error} If student is not authorized or other error occurs.
   */
  async getLessonVideoPlaybackDetails(lessonId, studentId) {
    const lesson = await this.findLessonById(lessonId); // Uses existing method

    if (!lesson) {
      throw new Error('Lesson not found.');
    }

    if (lesson.content_type !== 'video' || !lesson.video_provider || !lesson.external_video_id) {
      throw new Error('This lesson does not have associated video content or is misconfigured.');
    }

    // --- 1. Authorization Check (Conceptual) ---
    // In a real application, this would involve checking:
    // - Is the student enrolled in lesson.course_id?
    // - OR is lesson.is_preview_allowed true?
    // For this task, we'll simulate this check.
    let isAuthorized = false;
    if (lesson.is_preview_allowed) {
      isAuthorized = true;
      logger.info(`Lesson ${lessonId} is allowed for preview by student ${studentId}.`);
    } else {
      // Conceptual: Check enrollment status for studentId in lesson.course_id
      // const enrollment = await EnrollmentService.checkEnrollment(studentId, lesson.course_id);
      // if (enrollment && enrollment.isActive) isAuthorized = true;
      // For now, assume if not preview, student must be enrolled (simulating successful check for any studentId)
      logger.info(`[Conceptual] Enrollment check for student ${studentId} in course ${lesson.course_id} for lesson ${lessonId}. Assuming authorized if not preview.`);
      isAuthorized = true; // SIMULATING AUTHORIZATION for non-preview content for any authenticated user.
    }

    if (!isAuthorized) {
      // This error might be different in a real scenario, e.g. a specific "Forbidden" error type.
      throw new Error('You are not authorized to view this video lesson.');
    }

    // --- 2. Conceptual Interaction with Video Provider ---
    // Based on lesson.video_provider, call the appropriate service or SDK method.
    // This section simulates returning secure playback details.
    let playbackDetails = {};
    const { video_provider: videoProvider, external_video_id: externalVideoId } = lesson;

    logger.info(`[Conceptual] Fetching playback details for lesson ${lessonId}, provider '${videoProvider}', video ID '${externalVideoId}'.`);

    switch (videoProvider) {
      case 'vimeo':
        // Conceptual: const vimeoUrl = await VimeoService.getSignedPlaybackUrl(externalVideoId, { userId: studentId });
        playbackDetails = {
          type: 'signed_url', // Or 'iframe_player_url' if Vimeo provides that
          url: `simulated_vimeo_signed_url_for_video_${externalVideoId}_user_${studentId}`,
          provider_player_props: { /* any props needed for Vimeo player SDK */ }
        };
        break;
      case 'youtube':
        // YouTube often uses direct embedding with its player API.
        // For private/unlisted videos, access control is managed on YouTube itself.
        // If using YouTube Data API for private videos, might involve different checks.
        playbackDetails = {
          type: 'youtube_video_id',
          videoId: externalVideoId, // Client uses YouTube Player SDK with this ID
          provider_player_props: { autoplay: 0 }
        };
        break;
      case 'mux':
        // Conceptual: const muxToken = await MuxService.getSignedPlaybackToken(externalVideoId, { userId: studentId, type: 'video' });
        playbackDetails = {
          type: 'mux_playback_id_with_token', // Or just 'mux_playback_id' if using public signed URLs
          playbackId: externalVideoId, // Mux often uses the external_id as playback_id directly or derived
          token: `simulated_mux_signed_token_for_${externalVideoId}_user_${studentId}`, // JWT for secure playback
          provider_player_props: { /* any props for Mux player */ }
        };
        break;
      case 'aws_mediaservices':
        // Conceptual: const cloudfrontSignedUrl = await AWSMediaService.getCloudFrontSignedUrl(`path/to/${externalVideoId}.m3u8`);
        playbackDetails = {
          type: 'hls_signed_url',
          url: `simulated_aws_mediaservices_signed_url_for_${externalVideoId}`,
          provider_player_props: { /* HLS.js or other player props */ }
        };
        break;
      case 'custom_s3':
         // Conceptual: const s3SignedUrl = await S3Service.getSignedUrl('getObject', { Bucket: BUCKET, Key: externalVideoId, Expires: 3600 });
        playbackDetails = {
          type: 's3_signed_url',
          url: `simulated_s3_signed_url_for_${externalVideoId}`,
          provider_player_props: {}
        };
        break;
      default:
        logger.warn(`Video provider '${videoProvider}' not fully supported or recognized for secure playback details generation.`);
        throw new Error(`Video playback is not available for this lesson due to unsupported provider: ${videoProvider}.`);
    }

    return {
      lesson_id: lesson.id,
      lesson_title: lesson.video_title_override || lesson.title, // Use override if available
      video_provider: videoProvider,
      video_duration_seconds: lesson.video_duration_seconds,
      playback_details: playbackDetails,
    };
  }
};

module.exports = LessonService;
