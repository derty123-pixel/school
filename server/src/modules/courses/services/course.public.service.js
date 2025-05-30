// server/src/modules/courses/services/course.public.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const CoursePublicService = {
  /**
   * Searches and filters public courses with pagination and sorting.
   * @param {object} options - Options for searching, filtering, sorting, and pagination.
   * @param {string} [options.searchTerm] - Term for full-text search.
   * @param {string} [options.categoryId] - UUID of the category to filter by.
   * @param {number} [options.minPrice] - Minimum price.
   * @param {number} [options.maxPrice] - Maximum price.
   * @param {string} [options.sortBy='created_at_desc'] - Sort order.
   *        Valid options: 'relevance', 'price_asc', 'price_desc', 'title_asc', 'title_desc', 'created_at_desc'.
   * @param {number} [options.page=1] - Page number for pagination.
   * @param {number} [options.limit=10] - Number of items per page.
   * @returns {Promise<object>} Object containing { courses: [], totalCount: 0, page: 1, limit: 10, totalPages: 0 }
   */
  async searchAndFilterPublicCourses(options = {}) {
    const {
      searchTerm,
      categoryId,
      minPrice,
      maxPrice,
      sortBy = 'created_at_desc', // Default sort order
      page = 1,
      limit = 10,
    } = options;

    const values = [];
    let paramCount = 0;

    let baseQuery = `
      FROM Courses c
      LEFT JOIN Users instructor ON c.instructor_id = instructor.id -- Assuming Users table for instructor details
      -- LEFT JOIN Categories cat ON c.category_id = cat.id -- Assuming Categories table
      WHERE c.status = 'published' -- Only fetch published courses
    `;

    const conditions = [];

    // Full-text search
    let searchTsVector = "";
    if (searchTerm) {
      // Example: Search in title and description
      // A more comprehensive search might include instructor name, category name if joined
      searchTsVector = `to_tsvector('english', c.title || ' ' || c.description)`;
      paramCount++;
      conditions.push(`${searchTsVector} @@ websearch_to_tsquery('english', $${paramCount})`);
      values.push(searchTerm);
    }

    // Category filter
    if (categoryId) {
      paramCount++;
      conditions.push(`c.category_id = $${paramCount}`);
      values.push(categoryId);
    }

    // Price filter
    if (minPrice !== undefined && minPrice !== null) {
      paramCount++;
      conditions.push(`c.price >= $${paramCount}`);
      values.push(minPrice);
    }
    if (maxPrice !== undefined && maxPrice !== null) {
      paramCount++;
      conditions.push(`c.price <= $${paramCount}`);
      values.push(maxPrice);
    }

    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }

    // Count query for pagination
    const countQuery = `SELECT COUNT(c.id) AS total_count ${baseQuery}`;

    // Main data query
    let selectQuery = `
      SELECT
        c.id, c.title, c.description, c.price, c.thumbnail_url, c.status, c.created_at, c.updated_at,
        c.category_id,
        -- cat.name AS category_name, -- Example if Categories table is joined
        instructor.id AS instructor_id,
        instructor.first_name AS instructor_first_name,
        instructor.last_name AS instructor_last_name
        ${searchTerm ? `, ts_rank_cd(${searchTsVector}, websearch_to_tsquery('english', $1)) AS relevance` : ""}
      ${baseQuery}
    `;

    // Order by
    let orderByClause = '';
    switch (sortBy) {
      case 'relevance':
        if (searchTerm) {
          orderByClause = 'ORDER BY relevance DESC, c.created_at DESC'; // $1 is searchTerm in this specific construction
        } else {
          orderByClause = 'ORDER BY c.created_at DESC'; // Fallback if no search term for relevance
        }
        break;
      case 'price_asc':
        orderByClause = 'ORDER BY c.price ASC, c.created_at DESC';
        break;
      case 'price_desc':
        orderByClause = 'ORDER BY c.price DESC, c.created_at DESC';
        break;
      case 'title_asc':
        orderByClause = 'ORDER BY c.title ASC, c.created_at DESC';
        break;
      case 'title_desc':
        orderByClause = 'ORDER BY c.title DESC, c.created_at DESC';
        break;
      case 'created_at_desc':
      default:
        orderByClause = 'ORDER BY c.created_at DESC';
        break;
    }
    selectQuery += ` ${orderByClause}`;

    // Pagination
    paramCount++;
    selectQuery += ` LIMIT $${paramCount}`;
    values.push(limit);
    paramCount++;
    selectQuery += ` OFFSET $${paramCount}`;
    values.push((page - 1) * limit);

    logger.debug('Executing search/filter query:', { selectQuery, countQuery, values, options });

    try {
      // Execute count query
      // Note: If searchTerm is used, the $1 in countQuery needs to be the searchTerm.
      // This means values for countQuery and selectQuery might need different setup if $1 is used differently.
      // For simplicity here, assuming $1 in relevance sorting (if searchTerm is present) is the first param.
      // A safer way is to ensure parameter indexing is consistent or build values array per query.

      // Rebuilding values for count query if searchTerm is present, to ensure correct param indexing.
      const countValues = [];
      let countParamCount = 0;
      if (searchTerm) { countParamCount++; countValues.push(searchTerm); }
      if (categoryId) { countParamCount++; countValues.push(categoryId); }
      if (minPrice !== undefined && minPrice !== null) { countParamCount++; countValues.push(minPrice); }
      if (maxPrice !== undefined && maxPrice !== null) { countParamCount++; countValues.push(maxPrice); }


      const { rows: countRows } = await db.pool.query(countQuery, countValues);
      const totalCount = parseInt(countRows[0].total_count, 10);

      // Execute main data query
      const { rows: courses } = await db.pool.query(selectQuery, values);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        courses,
        totalCount,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages,
      };
    } catch (error) {
      logger.error('Error searching/filtering public courses:', { stack: error.stack, options });
      throw error;
    }
  }
};

module.exports = CoursePublicService;

/**
 * 2. Illustrate Necessary SQL Index (Conceptual):
 *
 * To support efficient full-text search on the `title` and `description` columns
 * of the `Courses` table, you would create a GIN (Generalized Inverted Index) index.
 *
 * Assuming your `Courses` table is defined, the SQL command would be:
 *
 * CREATE INDEX courses_fts_idx ON Courses USING GIN (to_tsvector('english', title || ' ' || description));
 *
 * Explanation:
 * - `courses_fts_idx`: This is the name of the index.
 * - `Courses`: The table to create the index on.
 * - `USING GIN`: Specifies the GIN index type, which is well-suited for full-text search.
 *   Alternatively, GIST can also be used but GIN is generally faster for FTS queries.
 * - `to_tsvector('english', title || ' ' || description)`: This is the expression being indexed.
 *   - `to_tsvector('english', ...)`: This function converts the text into a `tsvector` type,
 *     which is a sorted list of distinct words (lexemes) that have been normalized
 *     (e.g., stemmed, stopwords removed) according to the 'english' text search configuration.
 *   - `title || ' ' || description`: Concatenates the title and description columns with a space
 *     in between, so they are searched as a single body of text. You can include more columns
 *     if needed (e.g., `c.instructor_name` if you denormalize or join it).
 *
 * This index allows PostgreSQL to quickly find rows where the `tsvector` representation
 * of `title` and `description` matches a `tsquery` derived from the search term.
 */
