// server/src/modules/discounts/services/discount.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const DiscountService = {
  /**
   * Create a new discount and its applicability rules.
   * @param {object} discountData - Core data for the Discounts table.
   * @param {Array<object>} [applicableEntitiesData=[]] - Array of { entity_type, entity_id }.
   * @param {string} adminUserId - ID of the admin user creating the discount.
   * @returns {Promise<object>} The created discount object with applicability.
   */
  async createDiscount(discountData, applicableEntitiesData = [], adminUserId) {
    const {
      name, description, discount_type, value, applicable_scope,
      min_purchase_amount, start_date, end_date, max_uses_total, is_active = true,
    } = discountData;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const discountQuery = `
        INSERT INTO Discounts
          (name, description, discount_type, value, applicable_scope,
           min_purchase_amount, start_date, end_date, max_uses_total, is_active,
           created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;
      const discountValues = [
        name, description, discount_type, value, applicable_scope,
        min_purchase_amount, start_date, end_date, max_uses_total, is_active,
        adminUserId, adminUserId,
      ];
      const { rows: discountRows } = await client.query(discountQuery, discountValues);
      const newDiscount = discountRows[0];

      const applicabilityRecords = [];
      if (applicable_scope === 'specific_courses' || applicable_scope === 'specific_categories') {
        if (Array.isArray(applicableEntitiesData) && applicableEntitiesData.length > 0) {
          for (const entity of applicableEntitiesData) {
            if (!entity.entity_type || !entity.entity_id) {
              throw new Error('Each applicable entity must have entity_type and entity_id.');
            }
            // Additional validation: entity_type should match applicable_scope (e.g., if scope is 'specific_courses', entity_type must be 'course')
            if (applicable_scope === 'specific_courses' && entity.entity_type !== 'course') {
                throw new Error(`Invalid entity_type '${entity.entity_type}' for applicable_scope '${applicable_scope}'. Expected 'course'.`);
            }
            if (applicable_scope === 'specific_categories' && entity.entity_type !== 'category') {
                throw new Error(`Invalid entity_type '${entity.entity_type}' for applicable_scope '${applicable_scope}'. Expected 'category'.`);
            }

            const applicabilityQuery = `
              INSERT INTO DiscountApplicability (discount_id, entity_type, entity_id)
              VALUES ($1, $2, $3)
              RETURNING *;
            `;
            const { rows: appRows } = await client.query(applicabilityQuery, [newDiscount.id, entity.entity_type, entity.entity_id]);
            applicabilityRecords.push(appRows[0]);
          }
        } else if (applicable_scope !== 'all_courses') { // 'all_courses' doesn't need entries here.
            // If scope is specific but no entities provided, it's a misconfiguration or an empty set.
            // Depending on desired behavior, could throw error or allow (discount applies to nothing).
            logger.warn(`Discount ${newDiscount.id} created with scope '${applicable_scope}' but no applicable entities were provided.`);
        }
      }
      newDiscount.applicability = applicabilityRecords;

      await client.query('COMMIT');
      logger.info(`Discount ${newDiscount.id} created by user ${adminUserId}.`);
      return newDiscount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating discount by user ${adminUserId}: ${error.message}`, { stack: error.stack, discountData });
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Find all discounts with optional filters.
   * @param {object} [filters={}] - e.g., { is_active: true, applicable_scope: 'specific_courses' }
   * @returns {Promise<Array>} An array of discount objects.
   */
  async findAllDiscounts(filters = {}) {
    let query = `
      SELECT d.*,
             COALESCE(json_agg(json_build_object('entity_type', da.entity_type, 'entity_id', da.entity_id)) FILTER (WHERE da.id IS NOT NULL), '[]') as applicability
      FROM Discounts d
      LEFT JOIN DiscountApplicability da ON d.id = da.discount_id
    `;
    const values = [];
    const conditions = [];
    let paramCount = 0;

    if (filters.is_active !== undefined) {
      paramCount++;
      conditions.push(`d.is_active = $${paramCount}`);
      values.push(filters.is_active);
    }
    if (filters.applicable_scope) {
      paramCount++;
      conditions.push(`d.applicable_scope = $${paramCount}`);
      values.push(filters.applicable_scope);
    }
    // Add more filters as needed

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' GROUP BY d.id ORDER BY d.created_at DESC;';

    try {
      const { rows } = await db.pool.query(query, values);
      return rows;
    } catch (error) {
      logger.error('Error finding all discounts:', { stack: error.stack, filters });
      throw error;
    }
  },

  /**
   * Find a discount by its ID, including its applicability rules.
   * @param {string} discountId - The ID of the discount.
   * @returns {Promise<object|null>} The discount object or null if not found.
   */
  async findDiscountById(discountId) {
    const query = `
      SELECT d.*,
             COALESCE(json_agg(json_build_object('entity_type', da.entity_type, 'entity_id', da.entity_id)) FILTER (WHERE da.id IS NOT NULL), '[]') as applicability
      FROM Discounts d
      LEFT JOIN DiscountApplicability da ON d.id = da.discount_id
      WHERE d.id = $1
      GROUP BY d.id;
    `;
    try {
      const { rows } = await db.pool.query(query, [discountId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding discount by ID ${discountId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Update an existing discount and its applicability rules.
   * Applicability rules are completely replaced.
   * @param {string} discountId - The ID of the discount to update.
   * @param {object} discountData - Core data for the Discounts table.
   * @param {Array<object>} [applicableEntitiesData=[]] - Array of { entity_type, entity_id }.
   * @param {string} adminUserId - ID of the admin user performing the update.
   * @returns {Promise<object|null>} The updated discount object or null if not found.
   */
  async updateDiscount(discountId, discountData, applicableEntitiesData = [], adminUserId) {
    const {
      name, description, discount_type, value, applicable_scope,
      min_purchase_amount, start_date, end_date, max_uses_total, is_active,
    } = discountData;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Update Discount details
      const discountUpdateFields = [];
      const discountUpdateValues = [];
      let dParamCount = 1;

      if (name !== undefined) { discountUpdateFields.push(`name = $${dParamCount++}`); discountUpdateValues.push(name); }
      if (description !== undefined) { discountUpdateFields.push(`description = $${dParamCount++}`); discountUpdateValues.push(description); }
      // ... (add all other updatable fields from discountData) ...
      if (discount_type !== undefined) { discountUpdateFields.push(`discount_type = $${dParamCount++}`); discountUpdateValues.push(discount_type); }
      if (value !== undefined) { discountUpdateFields.push(`value = $${dParamCount++}`); discountUpdateValues.push(value); }
      if (applicable_scope !== undefined) { discountUpdateFields.push(`applicable_scope = $${dParamCount++}`); discountUpdateValues.push(applicable_scope); }
      if (min_purchase_amount !== undefined) { discountUpdateFields.push(`min_purchase_amount = $${dParamCount++}`); discountUpdateValues.push(min_purchase_amount); }
      if (start_date !== undefined) { discountUpdateFields.push(`start_date = $${dParamCount++}`); discountUpdateValues.push(start_date); }
      if (end_date !== undefined) { discountUpdateFields.push(`end_date = $${dParamCount++}`); discountUpdateValues.push(end_date); }
      if (max_uses_total !== undefined) { discountUpdateFields.push(`max_uses_total = $${dParamCount++}`); discountUpdateValues.push(max_uses_total); }
      // current_uses_total typically not updated directly by admin here
      if (is_active !== undefined) { discountUpdateFields.push(`is_active = $${dParamCount++}`); discountUpdateValues.push(is_active); }

      let updatedDiscount = null;
      if (discountUpdateFields.length > 0) {
        discountUpdateFields.push(`updated_by = $${dParamCount++}`); discountUpdateValues.push(adminUserId);
        // updated_at is handled by trigger
        discountUpdateValues.push(discountId); // For WHERE clause

        const updateDiscountQuery = `
          UPDATE Discounts
          SET ${discountUpdateFields.join(', ')}
          WHERE id = $${dParamCount}
          RETURNING *;
        `;
        const { rows: updatedDiscountRows } = await client.query(updateDiscountQuery, discountUpdateValues);
        if (updatedDiscountRows.length === 0) {
          await client.query('ROLLBACK'); client.release(); return null; // Discount not found
        }
        updatedDiscount = updatedDiscountRows[0];
      } else {
        // Fetch current if no discount fields changed, as applicability might still change
        const currentDiscount = await this.findDiscountById(discountId); // This uses a separate client, not ideal in transaction
        if (!currentDiscount) { await client.query('ROLLBACK'); client.release(); return null; }
        updatedDiscount = currentDiscount; // Use fetched one
        // To use same client: await client.query('SELECT * FROM Discounts WHERE id = $1', [discountId])
      }

      // Delete existing applicability rules
      await client.query('DELETE FROM DiscountApplicability WHERE discount_id = $1;', [discountId]);

      // Insert new applicability rules
      const applicabilityRecords = [];
      const currentScope = updatedDiscount.applicable_scope; // Use the scope from the (potentially) updated discount
      if (currentScope === 'specific_courses' || currentScope === 'specific_categories') {
        if (Array.isArray(applicableEntitiesData) && applicableEntitiesData.length > 0) {
          for (const entity of applicableEntitiesData) {
             if (!entity.entity_type || !entity.entity_id) {
              throw new Error('Each applicable entity must have entity_type and entity_id.');
            }
            if (currentScope === 'specific_courses' && entity.entity_type !== 'course') {
                throw new Error(`Invalid entity_type '${entity.entity_type}' for applicable_scope '${currentScope}'. Expected 'course'.`);
            }
            if (currentScope === 'specific_categories' && entity.entity_type !== 'category') {
                throw new Error(`Invalid entity_type '${entity.entity_type}' for applicable_scope '${currentScope}'. Expected 'category'.`);
            }
            const applicabilityQuery = `
              INSERT INTO DiscountApplicability (discount_id, entity_type, entity_id)
              VALUES ($1, $2, $3)
              RETURNING *;
            `;
            const { rows: appRows } = await client.query(applicabilityQuery, [discountId, entity.entity_type, entity.entity_id]);
            applicabilityRecords.push(appRows[0]);
          }
        } else if (currentScope !== 'all_courses') {
             logger.warn(`Discount ${discountId} updated with scope '${currentScope}' but no applicable entities were provided.`);
        }
      }
      updatedDiscount.applicability = applicabilityRecords; // Attach fresh applicability

      await client.query('COMMIT');
      logger.info(`Discount ${discountId} updated by user ${adminUserId}.`);
      return updatedDiscount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating discount ${discountId} by user ${adminUserId}: ${error.message}`, { stack: error.stack, discountData });
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Soft delete a discount (sets is_active = false).
   * @param {string} discountId - The ID of the discount to delete.
   * @param {string} adminUserId - ID of the admin user performing the action.
   * @returns {Promise<object|null>} The soft-deleted discount object or null if not found.
   */
  async deleteDiscount(discountId, adminUserId) {
    const query = `
      UPDATE Discounts
      SET is_active = false, updated_by = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    try {
      const { rows } = await db.pool.query(query, [adminUserId, discountId]);
      if (rows.length === 0) return null;
      logger.info(`Discount ${discountId} soft deleted (deactivated) by user ${adminUserId}.`);
      return rows[0];
    } catch (error) {
      logger.error(`Error soft deleting discount ${discountId} by user ${adminUserId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },
};

module.exports = DiscountService;
