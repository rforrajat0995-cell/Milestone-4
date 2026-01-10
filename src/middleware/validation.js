/**
 * Request Validation Middleware
 */

import { ValidationError } from '../errors/AppError.js';

/**
 * Validate request body
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }
    next();
  };
}

/**
 * Validate request parameters
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }
    next();
  };
}

/**
 * Validate request query
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }
    next();
  };
}

