// server/src/modules/inventory/services/inventory.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const InventoryService = {
  /**
   * Determines stock status based on quantity and threshold.
   * @param {number} quantityAvailable
   * @param {number|null} lowStockThreshold
   * @returns {string} Stock status ('in_stock', 'out_of_stock', 'low_stock')
   */
  _determineStockStatus(quantityAvailable, lowStockThreshold) {
    if (quantityAvailable <= 0) {
      return 'out_of_stock';
    }
    if (lowStockThreshold !== null && quantityAvailable <= lowStockThreshold) {
      return 'low_stock';
    }
    return 'in_stock';
  },

  /**
   * Sets or initializes stock for a product. Creates an inventory record if none exists.
   * @param {string} productId - The ID of the product (course_id).
   * @param {number} quantityAvailable - The initial quantity available.
   * @param {number|null} [lowStockThreshold] - Optional low stock threshold.
   * @param {string} adminUserId - ID of the admin performing the action (for audit, if needed).
   * @returns {Promise<object>} The created or updated inventory record.
   */
  async setInitialStock(productId, quantityAvailable, lowStockThreshold, adminUserId) {
    if (quantityAvailable < 0) {
      throw new Error('Quantity available cannot be negative.');
    }
    if (lowStockThreshold !== null && lowStockThreshold < 0) {
      throw new Error('Low stock threshold cannot be negative.');
    }

    const stockStatus = this._determineStockStatus(quantityAvailable, lowStockThreshold);
    const now = new Date();

    const query = `
      INSERT INTO ProductInventory
        (product_id, quantity_available, stock_status, low_stock_threshold, last_stock_update, version, reserved_quantity)
      VALUES ($1, $2, $3, $4, $5, 1, 0)
      ON CONFLICT (product_id)
      DO UPDATE SET
        quantity_available = EXCLUDED.quantity_available,
        stock_status = EXCLUDED.stock_status,
        low_stock_threshold = EXCLUDED.low_stock_threshold,
        last_stock_update = EXCLUDED.last_stock_update,
        version = ProductInventory.version + 1, -- Increment version on any update
        reserved_quantity = ProductInventory.reserved_quantity -- Keep existing reserved quantity
      RETURNING *;
    `;
    // Note: adminUserId is not directly stored on ProductInventory in this schema, but could be logged or added.
    const values = [productId, quantityAvailable, stockStatus, lowStockThreshold, now];

    try {
      const { rows } = await db.pool.query(query, values);
      logger.info(`Stock initialized/set for product ${productId} to ${quantityAvailable} by user ${adminUserId}.`);
      return rows[0];
    } catch (error) {
      logger.error(`Error setting initial stock for product ${productId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Updates stock for a product.
   * Can take a change in quantity or a new absolute quantity.
   * Implements optimistic locking using the version column.
   * @param {string} productId - The ID of the product (course_id).
   * @param {number} [change] - The change in quantity (e.g., -5 or 10).
   * @param {number} [newQuantity] - The new absolute quantity_available.
   * @param {number} [lowStockThresholdUpdate] - Optional: new low stock threshold.
   * @param {number} currentVersion - The current version of the inventory record (for optimistic locking).
   * @param {string} adminUserId - ID of the admin performing the action.
   * @returns {Promise<object>} The updated inventory record.
   * @throws {Error} If product not found, version mismatch, or invalid quantities.
   */
  async updateStock(productId, { change, newQuantity, lowStockThresholdUpdate }, currentVersion, adminUserId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch current inventory record, including version and low_stock_threshold
      const selectQuery = 'SELECT * FROM ProductInventory WHERE product_id = $1;';
      const { rows: currentRows } = await client.query(selectQuery, [productId]);
      if (currentRows.length === 0) {
        throw new Error('Product inventory not found. Initialize stock first.');
      }
      const currentInventory = currentRows[0];

      // Optimistic locking check
      if (currentVersion !== undefined && currentInventory.version !== parseInt(currentVersion, 10)) {
        throw new Error('Inventory data is stale. Please refresh and try again. (Version mismatch)');
      }

      let calculatedNewQuantity;
      if (newQuantity !== undefined && newQuantity !== null) {
        calculatedNewQuantity = parseInt(newQuantity, 10);
      } else if (change !== undefined && change !== null) {
        calculatedNewQuantity = currentInventory.quantity_available + parseInt(change, 10);
      } else {
        // If neither change nor newQuantity is provided, only lowStockThreshold might be updated
        calculatedNewQuantity = currentInventory.quantity_available;
      }

      if (calculatedNewQuantity < 0) {
        throw new Error('Quantity available cannot become negative.');
      }
      // Ensure reserved_quantity constraint is not violated if it's actively used and not changing here
      if (currentInventory.reserved_quantity > calculatedNewQuantity) {
          throw new Error('Update would make quantity available less than reserved quantity. Adjust reservations first.');
      }


      const newLowStockThreshold = lowStockThresholdUpdate !== undefined ? lowStockThresholdUpdate : currentInventory.low_stock_threshold;
      if (newLowStockThreshold !== null && newLowStockThreshold < 0) {
          throw new Error('Low stock threshold cannot be negative.');
      }

      const newStockStatus = this._determineStockStatus(calculatedNewQuantity, newLowStockThreshold);
      const now = new Date();
      const nextVersion = currentInventory.version + 1;

      const updateQuery = `
        UPDATE ProductInventory
        SET
          quantity_available = $1,
          stock_status = $2,
          low_stock_threshold = $3,
          last_stock_update = $4,
          version = $5
        WHERE product_id = $6 AND version = $7 -- Optimistic lock
        RETURNING *;
      `;
      const values = [
        calculatedNewQuantity, newStockStatus, newLowStockThreshold, now, nextVersion,
        productId, currentInventory.version,
      ];

      const { rows: updatedRows } = await client.query(updateQuery, values);
      if (updatedRows.length === 0) {
        // This means the record was changed by another process after we fetched it (version mismatch again)
        // or product_id was wrong (already checked by initial select).
        throw new Error('Failed to update stock due to concurrent modification. Please try again.');
      }

      await client.query('COMMIT');
      logger.info(`Stock updated for product ${productId} by user ${adminUserId}. New quantity: ${calculatedNewQuantity}, Version: ${nextVersion}`);
      return updatedRows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating stock for product ${productId}: ${error.message}`, { stack: error.stack });
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get inventory details for a specific product.
   * @param {string} productId - The ID of the product (course_id).
   * @returns {Promise<object|null>} The inventory object or null if not found.
   */
  async getStockByProductId(productId) {
    const query = 'SELECT * FROM ProductInventory WHERE product_id = $1;';
    try {
      const { rows } = await db.pool.query(query, [productId]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error getting stock for product ${productId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * List all product inventory records with optional filters and pagination.
   * @param {object} [filters={}] - e.g., { stock_status: 'low_stock', page: 1, limit: 20 }
   * @returns {Promise<{inventory: Array, totalCount: number, page: number, limit: number, totalPages: number}>}
   */
  async listAllInventory(filters = {}) {
    const { stock_status, page = 1, limit = 10 } = filters;
    const values = [];
    let paramCount = 0;

    let baseQuery = 'FROM ProductInventory pi'; // JOIN with Courses if product title needed: JOIN Courses c ON pi.product_id = c.id
    const conditions = [];

    if (stock_status) {
      paramCount++;
      conditions.push(`pi.stock_status = $${paramCount}`);
      values.push(stock_status);
    }
    // Add product_id filter if needed:
    // if (filters.product_id) { ... }

    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const countQuery = `SELECT COUNT(*) AS total_count ${baseQuery};`;

    let selectQuery = `SELECT pi.* /*, c.title AS product_title */ ${baseQuery} ORDER BY pi.last_stock_update DESC`;

    paramCount++;
    selectQuery += ` LIMIT $${paramCount}`;
    values.push(limit);
    paramCount++;
    selectQuery += ` OFFSET $${paramCount}`;
    values.push((page - 1) * limit);

    try {
      const countParams = values.slice(0, values.length - 2); // Params for count query are those before limit/offset
      const { rows: countRows } = await db.pool.query(countQuery, countParams);
      const totalCount = parseInt(countRows[0].total_count, 10);

      const { rows: inventory } = await db.pool.query(selectQuery, values);
      const totalPages = Math.ceil(totalCount / limit);

      return {
        inventory,
        totalCount,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages,
      };
    } catch (error) {
      logger.error('Error listing all inventory:', { stack: error.stack, filters });
      throw error;
    }
  },

  /**
   * Decrements stock for a product, typically when an order is placed.
   * Uses optimistic locking.
   * @param {string} productId - The ID of the product (course_id).
   * @param {number} quantityToDecrement - The quantity to decrement.
   * @param {number} currentVersion - The current version of the inventory record for optimistic locking.
   * @param {object} client - The active database client for transaction.
   * @returns {Promise<object>} The updated inventory record.
   * @throws {Error} If insufficient stock, product not found, or version mismatch.
   */
  async decrementStockForOrder(productId, quantityToDecrement, currentVersion, client) {
    if (quantityToDecrement <= 0) {
      throw new Error('Quantity to decrement must be positive.');
    }

    // Fetch current inventory record using the provided client and lock the row for update
    // FOR UPDATE is important here to prevent other transactions from modifying this row until this transaction commits or rolls back.
    const selectQuery = 'SELECT * FROM ProductInventory WHERE product_id = $1 FOR UPDATE;';
    const { rows: currentRows } = await client.query(selectQuery, [productId]);
    if (currentRows.length === 0) {
      throw new Error(`Inventory record not found for product ${productId}. Cannot fulfill order.`);
    }
    const currentInventory = currentRows[0];

    // Optimistic locking check
    if (currentInventory.version !== parseInt(currentVersion, 10)) {
      throw new Error(`Inventory data for product ${productId} is stale (version mismatch). Please retry order.`);
    }

    // Check if sufficient stock is available (considering reserved_quantity if it were actively used for reservations)
    // For this implementation, we are directly decrementing quantity_available.
    // A more complex system might first move quantity_available to reserved_quantity, then fulfill from reserved.
    if (currentInventory.quantity_available < quantityToDecrement) {
      throw new Error(`Insufficient stock for product ${productId}. Available: ${currentInventory.quantity_available}, Requested: ${quantityToDecrement}`);
    }

    const newQuantityAvailable = currentInventory.quantity_available - quantityToDecrement;
    const newLowStockThreshold = currentInventory.low_stock_threshold; // Unchanged by this operation
    const newStockStatus = this._determineStockStatus(newQuantityAvailable, newLowStockThreshold);
    const now = new Date();
    const nextVersion = currentInventory.version + 1;

    const updateQuery = `
      UPDATE ProductInventory
      SET
        quantity_available = $1,
        stock_status = $2,
        last_stock_update = $3,
        version = $4
      WHERE product_id = $5 AND version = $6 -- Optimistic lock and ensure it's the same product_id
      RETURNING *;
    `;
    const values = [
      newQuantityAvailable, newStockStatus, now, nextVersion,
      productId, currentInventory.version,
    ];

    const { rows: updatedRows } = await client.query(updateQuery, values);

    if (updatedRows.length === 0) {
      // This should ideally not happen if FOR UPDATE and version check worked, but as a safeguard.
      throw new Error(`Failed to update stock for product ${productId} due to concurrent modification or data issue. Please retry order.`);
    }

    logger.info(`Stock decremented for product ${productId} by ${quantityToDecrement}. New quantity: ${newQuantityAvailable}, Version: ${nextVersion}`);
    return updatedRows[0];
  }
};

module.exports = InventoryService;
