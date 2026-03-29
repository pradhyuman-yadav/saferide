import type { Request, Response } from 'express';
import { StudentService } from '../services/student.service';
import { auditLog } from '@saferide/logger';

const service = new StudentService();

export class StudentController {
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const students = await service.listStudents(tenantId);
    res.json({ success: true, data: students });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    const student = await service.findStudent(id, tenantId);
    if (student === null) {
      res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found.' } });
      return;
    }
    res.json({ success: true, data: student });
  }

  async create(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const student = await service.createStudent(req.body, tenantId);
    auditLog({
      action:    'STUDENT_CREATED',
      actorId:   req.user.uid,
      actorRole: req.user.role,
      tenantId,
      targetId:  student.id,
      meta:      { name: student.name, parentFirebaseUid: student.parentFirebaseUid },
    });
    res.status(201).json({ success: true, data: student });
  }

  async update(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      const student = await service.updateStudent(id, req.body, tenantId);
      auditLog({
        action:    'STUDENT_UPDATED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
      });
      res.json({ success: true, data: student });
    } catch (err) {
      if (err instanceof Error && err.message === 'STUDENT_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found.' } });
        return;
      }
      throw err;
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      await service.deleteStudent(id, tenantId);
      auditLog({
        action:    'STUDENT_DELETED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
      });
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'STUDENT_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found.' } });
        return;
      }
      throw err;
    }
  }
}
