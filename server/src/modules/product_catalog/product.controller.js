// server/src/modules/product_catalog/product.controller.js
const productService = require('./product.service');
const { validationResult } = require('express-validator');

class ProductController {
  async createProduct(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, sku, description, price, category_id, image_urls, initial_quantity } = req.body;

    try {
      const product = await productService.createProduct({
        name, sku, description, price, category_id, image_urls, initial_quantity
      });
      res.status(201).json({ message: 'Product created successfully.', product });
    } catch (error) {
      console.error('Product creation controller error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred during product creation.' });
    }
  }

  async getAllProducts(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { page = 1, limit = 10, category_id } = req.query;
    try {
      const result = await productService.getAllProducts({ page: parseInt(page), limit: parseInt(limit), category_id });
      res.status(200).json(result);
    } catch (error) {
      console.error('Get all products controller error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred while fetching products.' });
    }
  }

  async getProductById(req, res) {
    const { productId } = req.params;
    // Check if user is admin (req.user should be populated by 'protect' middleware)
    const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');

    try {
      const product = await productService.getProductById(productId, isAdmin);
      res.status(200).json(product);
    } catch (error) {
      console.error(`Get product by ID controller error (ID: ${productId}):`, error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred while fetching the product.' });
    }
  }

  async updateProduct(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { productId } = req.params;
    const updateData = req.body; // Contains fields to update

    try {
      const updatedProduct = await productService.updateProduct(productId, updateData);
      res.status(200).json({ message: 'Product updated successfully.', product: updatedProduct });
    } catch (error) {
      console.error(`Update product controller error (ID: ${productId}):`, error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred while updating the product.' });
    }
  }

  async deleteProduct(req, res) {
    const { productId } = req.params;
    try {
      const result = await productService.deleteProduct(productId);
      res.status(200).json(result); // e.g., { message: 'Product deleted successfully.', id: productId }
    } catch (error) {
      console.error(`Delete product controller error (ID: ${productId}):`, error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred while deleting the product.' });
    }
  }

  async updateInventory(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { productId } = req.params;
    const { quantity_available, low_stock_threshold } = req.body;

    try {
      const updatedInventory = await productService.updateInventory(productId, { quantity_available, low_stock_threshold });
      res.status(200).json({ message: 'Inventory updated successfully.', inventory: updatedInventory });
    } catch (error) {
      console.error(`Update inventory controller error (Product ID: ${productId}):`, error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred while updating inventory.' });
    }
  }
}

module.exports = new ProductController();
