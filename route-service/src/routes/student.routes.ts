import { Router } from 'express';
import { verifyJwt, requireRole, readRateLimiter, validateBody } from '@saferide/middleware';
import { CreateStudentSchema, UpdateStudentSchema } from '@saferide/types';
import { StudentController } from '../controllers/student.controller';

const controller = new StudentController();
export const studentRouter = Router();

// All student routes require authentication + standard rate limiting
studentRouter.use(readRateLimiter);
studentRouter.use(verifyJwt);

// GET /api/v1/students
studentRouter.get(
  '/',
  requireRole('school_admin', 'manager'),
  (req, res, next) => { controller.list(req, res).catch(next); },
);

// GET /api/v1/students/:id
studentRouter.get(
  '/:id',
  requireRole('school_admin', 'manager'),
  (req, res, next) => { controller.getById(req, res).catch(next); },
);

// POST /api/v1/students
studentRouter.post(
  '/',
  requireRole('school_admin', 'manager'),
  validateBody(CreateStudentSchema),
  (req, res, next) => { controller.create(req, res).catch(next); },
);

// PATCH /api/v1/students/:id
studentRouter.patch(
  '/:id',
  requireRole('school_admin', 'manager'),
  validateBody(UpdateStudentSchema),
  (req, res, next) => { controller.update(req, res).catch(next); },
);

// DELETE /api/v1/students/:id — soft delete (isActive → false)
studentRouter.delete(
  '/:id',
  requireRole('school_admin'),
  (req, res, next) => { controller.delete(req, res).catch(next); },
);
