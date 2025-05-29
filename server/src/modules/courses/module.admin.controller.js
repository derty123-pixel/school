// server/src/modules/courses/module.admin.controller.js
const moduleAdminService = require('./module.admin.service');
const { validationResult } = require('express-validator');

class ModuleAdminController {
  async createModule(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId } = req.params;
    const { title, description, module_order } = req.body;
    try {
      const newModule = await moduleAdminService.createModule(courseId, req.user, { title, description, module_order });
      res.status(201).json({ message: 'Module created successfully.', module: newModule });
    } catch (error) {
      console.error(`Create module controller error (Course ID: ${courseId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to create module.' });
    }
  }

  async getModulesForCourse(req, res) {
    const errors = validationResult(req); // For param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId } = req.params;
    try {
      const modules = await moduleAdminService.getModulesForCourse(courseId, req.user);
      res.status(200).json(modules);
    } catch (error) {
      console.error(`Get modules for course controller error (Course ID: ${courseId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve modules.' });
    }
  }

  async getModuleById(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId, moduleId } = req.params;
    try {
      const moduleData = await moduleAdminService.getModuleById(courseId, moduleId, req.user);
      res.status(200).json(moduleData);
    } catch (error) {
      console.error(`Get module by ID controller error (Course ID: ${courseId}, Module ID: ${moduleId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve module.' });
    }
  }

  async updateModule(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId, moduleId } = req.params;
    const updateData = req.body;
    try {
      const updatedModule = await moduleAdminService.updateModule(courseId, moduleId, req.user, updateData);
      res.status(200).json({ message: 'Module updated successfully.', module: updatedModule });
    } catch (error) {
      console.error(`Update module controller error (Course ID: ${courseId}, Module ID: ${moduleId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to update module.' });
    }
  }

  async deleteModule(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId, moduleId } = req.params;
    try {
      const result = await moduleAdminService.deleteModule(courseId, moduleId, req.user);
      res.status(200).json(result);
    } catch (error) {
      console.error(`Delete module controller error (Course ID: ${courseId}, Module ID: ${moduleId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to delete module.' });
    }
  }
}

module.exports = new ModuleAdminController();
