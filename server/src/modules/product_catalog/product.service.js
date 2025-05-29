// server/src/modules/product_catalog/product.service.js
const db = require('../../config/database');

class ProductService {
  async createProduct({ name, sku, description, price, category_id, image_urls, initial_quantity = 0 }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert into products table
      const productQuery = `
        INSERT INTO products (name, sku, description, price, category_id, image_urls, is_published)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, sku, description, price, category_id, image_urls, is_published, created_at, updated_at;
      `;
      // For MVP, let's assume is_published is true by default or set by admin. Here, setting to false.
      const productResult = await client.query(productQuery, [name, sku, description, price, category_id, image_urls, false]);
      const newProduct = productResult.rows[0];

      // Insert into product_inventory table
      const inventoryQuery = `
        INSERT INTO product_inventory (product_id, quantity_available)
        VALUES ($1, $2)
        RETURNING id, product_id, quantity_available, last_restocked_at;
      `;
      const inventoryResult = await client.query(inventoryQuery, [newProduct.id, initial_quantity]);
      const newInventory = inventoryResult.rows[0];

      await client.query('COMMIT');
      return { ...newProduct, inventory: newInventory };

    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'products_sku_key') {
          throw { statusCode: 409, message: `Product with SKU '${sku}' already exists.` };
        }
      }
      if (error.code === '23503' && error.constraint === 'products_category_id_fkey') { // Foreign key violation
           throw { statusCode: 400, message: `Invalid category ID: '${category_id}'. Category does not exist.`};
      }
      console.error('Error creating product with inventory:', error);
      throw { statusCode: 500, message: 'Error creating product.' };
    } finally {
      client.release();
    }
  }

  async getAllProducts({ page = 1, limit = 10, category_id = null }) {
    const offset = (page - 1) * limit;
    let queryParams = [limit, offset];
    let whereClauses = ["p.is_published = TRUE"]; // By default, only show published products on public listings

    if (category_id) {
      whereClauses.push(`p.category_id = $${queryParams.length + 1}`);
      queryParams.push(category_id);
    }
    
    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : "";

    const productsQuery = `
      SELECT 
        p.id, p.name, p.sku, p.description, p.price, p.category_id, c.name as category_name, 
        p.image_urls, p.is_published, p.created_at, p.updated_at,
        pi.quantity_available
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN product_inventory pi ON p.id = pi.product_id
      ${whereString}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const countQuery = `
      SELECT COUNT(p.id) 
      FROM products p
      ${whereString};
    `; // Count query needs to respect the same filters

    try {
      const productsResult = await db.query(productsQuery, queryParams);
      
      // Adjust count query params: remove limit and offset for total count
      const countQueryParams = queryParams.slice(2); // only filter params
      const countResult = await db.query(countQuery, countQueryParams);
      
      const totalProducts = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalProducts / limit);

      return {
        products: productsResult.rows,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages,
          totalProducts,
          limit: parseInt(limit, 10),
        }
      };
    } catch (error) {
      console.error('Error fetching all products:', error);
      throw { statusCode: 500, message: 'Error fetching products.' };
    }
  }

  async getProductById(productId, isAdmin = false) {
    // Admin can see unpublished products, public cannot
    const productQuery = `
      SELECT 
        p.id, p.name, p.sku, p.description, p.price, p.category_id, c.name as category_name, 
        p.image_urls, p.is_published, p.created_at, p.updated_at,
        pi.quantity_available, pi.low_stock_threshold, pi.last_restocked_at
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN product_inventory pi ON p.id = pi.product_id
      WHERE p.id = $1 ${isAdmin ? '' : 'AND p.is_published = TRUE'};
    `;
    try {
      const { rows } = await db.query(productQuery, [productId]);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Product not found or not available.' };
      }
      return rows[0];
    } catch (error) {
      if (error.statusCode === 404) throw error;
      console.error('Error fetching product by ID:', error);
      throw { statusCode: 500, message: 'Error fetching product.' };
    }
  }

  async updateProduct(productId, updateData) {
    // Destructure allowed fields to update for products table
    const { name, description, price, category_id, image_urls, is_published, sku } = updateData;
    
    // Build the SET clause dynamically for products table
    const productSetClauses = [];
    const productValues = [];
    let paramCount = 1;

    if (name !== undefined) { productSetClauses.push(`name = $${paramCount++}`); productValues.push(name); }
    if (sku !== undefined) { productSetClauses.push(`sku = $${paramCount++}`); productValues.push(sku); }
    if (description !== undefined) { productSetClauses.push(`description = $${paramCount++}`); productValues.push(description); }
    if (price !== undefined) { productSetClauses.push(`price = $${paramCount++}`); productValues.push(price); }
    if (category_id !== undefined) { productSetClauses.push(`category_id = $${paramCount++}`); productValues.push(category_id); }
    if (image_urls !== undefined) { productSetClauses.push(`image_urls = $${paramCount++}`); productValues.push(image_urls); }
    if (is_published !== undefined) { productSetClauses.push(`is_published = $${paramCount++}`); productValues.push(is_published); }

    if (productSetClauses.length === 0) {
      // If no product fields to update, just fetch and return the product
      // Or, this could be an error if an update was expected. For now, fetch and return.
      return this.getProductById(productId, true); // true for admin view
    }
    productSetClauses.push(`updated_at = CURRENT_TIMESTAMP`); // Ensure updated_at is always set

    const productUpdateQuery = `
      UPDATE products
      SET ${productSetClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *;
    `;
    productValues.push(productId);

    try {
      const { rows } = await db.query(productUpdateQuery, productValues);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Product not found for update.' };
      }
       // Fetch full product details including inventory after update
      return this.getProductById(productId, true);
    } catch (error) {
      if (error.statusCode === 404) throw error;
      if (error.code === '23505' && error.constraint === 'products_sku_key') {
         throw { statusCode: 409, message: `Product with SKU '${sku}' already exists.` };
      }
      if (error.code === '23503' && error.constraint === 'products_category_id_fkey') {
           throw { statusCode: 400, message: `Invalid category ID: '${category_id}'. Category does not exist.`};
      }
      console.error('Error updating product:', error);
      throw { statusCode: 500, message: 'Error updating product.' };
    }
  }

  async deleteProduct(productId) {
    // Deleting a product will also delete its inventory due to ON DELETE CASCADE
    const query = 'DELETE FROM products WHERE id = $1 RETURNING id;';
    try {
      const { rows } = await db.query(query, [productId]);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Product not found for deletion.' };
      }
      return { message: 'Product deleted successfully.', id: rows[0].id };
    } catch (error) {
      if (error.statusCode === 404) throw error;
      console.error('Error deleting product:', error);
      throw { statusCode: 500, message: 'Error deleting product.' };
    }
  }

  async updateInventory(productId, { quantity_available, low_stock_threshold }) {
    const setClauses = [];
    const values = [];
    let paramCount = 1;

    if (quantity_available !== undefined) {
      setClauses.push(`quantity_available = $${paramCount++}`);
      values.push(quantity_available);
    }
    if (low_stock_threshold !== undefined) {
      setClauses.push(`low_stock_threshold = $${paramCount++}`);
      values.push(low_stock_threshold);
    }
    
    if (setClauses.length === 0) {
        throw { statusCode: 400, message: 'No inventory data provided for update.' };
    }
    
    // Always update last_restocked_at if quantity changes, or updated_at for other changes
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    if (quantity_available !== undefined) { // Consider if last_restocked_at should only update on increase
        setClauses.push(`last_restocked_at = CURRENT_TIMESTAMP`);
    }


    const query = `
      UPDATE product_inventory
      SET ${setClauses.join(', ')}
      WHERE product_id = $${paramCount}
      RETURNING *;
    `;
    values.push(productId);

    try {
      const { rows } = await db.query(query, values);
      if (rows.length === 0) {
        // This case might mean the product exists but has no inventory record.
        // For MVP, we assume inventory record is created with product.
        // Could also try to INSERT if not found.
        throw { statusCode: 404, message: 'Inventory record not found for this product. Create product first.' };
      }
      return rows[0];
    } catch (error) {
      if (error.statusCode === 404) throw error;
      if (error.code === '23514' && error.constraint === 'product_inventory_quantity_available_check') { // check_violation
          throw { statusCode: 400, message: 'Quantity available cannot be negative.' };
      }
      console.error('Error updating inventory:', error);
      throw { statusCode: 500, message: 'Error updating inventory.' };
    }
  }
}

module.exports = new ProductService();
