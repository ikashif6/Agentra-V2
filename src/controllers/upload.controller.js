const path = require('path');
const fs = require('fs');
const response = require('../utils/apiResponse');

// Base URL for serving uploaded files
const BASE_URL = process.env.APP_API_URL || `http://localhost:${process.env.PORT || 5000}`;

/**
 * POST /api/uploads
 * Upload one or more files; returns their public URLs.
 *
 * Files are stored under /uploads/<subdomain>/<date>/<filename>
 * so each tenant's files are isolated in their own directory.
 *
 * Protected: must be authenticated OR carry a valid track-session token.
 */
exports.uploadFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return response.badRequest(res, 'No files uploaded');
    }

    const results = req.files.map((file) => ({
      url: `${BASE_URL}/api/uploads/${file.filename}`,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }));

    return response.success(res, { attachments: results }, 'Files uploaded successfully');
  } catch (err) {
    next(err);
  }
};
