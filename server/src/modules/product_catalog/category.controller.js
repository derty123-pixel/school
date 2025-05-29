// server/src/modules/product_catalog/category.controller.js
const categoryService = require('./category.service');
const { validationResult } = require('express-validator');

class CategoryController {
  async createCategory(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, parent_category_id } = req.body;

    try {
      const category = await categoryService.createCategory({ name, description, parent_category_id });
      res.status(201).json({ message: 'Category created successfully.', category });
    } catch (error) {
      console.error('Category creation controller error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred during category creation.' });
    }
  }

  async getAllCategories(req, res) {
    try {
      const categories = await categoryService.getAllCategories();
      res.status(200).json(categories);
    } catch (error) {
      console.error('Get all categories controller error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred while fetching categories.' });
    }
  }

  async getCategoryById(req, res) {
    const { categoryId } = req.params;
    try {
        const category = await categoryService.getCategoryById(categoryId);
        res.status(200).json(category);
    } catch (error) {
        console.error(`Get category by ID controller error (ID: ${categoryId}):`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred while fetching the category.' });
    }
  }
}

module.exports = new CategoryController();
