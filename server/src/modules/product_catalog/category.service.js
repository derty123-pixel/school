// server/src/modules/product_catalog/category.service.js
const db = require('../../config/database');

class CategoryService {
  async createCategory({ name, description, parent_category_id = null }) {
    const query = `
      INSERT INTO product_categories (name, description, parent_category_id)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, parent_category_id, created_at, updated_at;
    `;
    try {
      const { rows } = await db.query(query, [name, description, parent_category_id]);
      return rows[0];
    } catch (error) {
      // Check for unique constraint violation for 'name'
      if (error.code === '23505' && error.constraint === 'product_categories_name_key') {
        throw { statusCode: 409, message: `A category with the name '${name}' already exists.` };
      }
      console.error('Error creating category:', error);
      throw { statusCode: 500, message: 'Error creating category in database.' };
    }
  }

  async getAllCategories() {
    // For MVP, a simple list. Could be enhanced with hierarchy later.
    const query = `
      SELECT id, name, description, parent_category_id, created_at, updated_at 
      FROM product_categories 
      ORDER BY name ASC;
    `;
    try {
      const { rows } = await db.query(query);
      return rows;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw { statusCode: 500, message: 'Error fetching categories from database.' };
    }
  }

  async getCategoryById(categoryId) {
    const query = `
      SELECT id, name, description, parent_category_id, created_at, updated_at
      FROM product_categories
      WHERE id = $1;
    `;
    try {
      const { rows } = await db.query(query, [categoryId]);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Category not found.' };
      }
      return rows[0];
    } catch (error) {
        if (error.statusCode === 404) throw error;
        console.error('Error fetching category by ID:', error);
        throw { statusCode: 500, message: 'Error fetching category by ID.' };
    }
  }
}

module.exports = new CategoryService();
