import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, auditLog } from '../src/index';

describe('logger', () => {
  it('is exported and has an info method', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('has an error method', () => {
    expect(typeof logger.error).toBe('function');
  });

  it('has a warn method', () => {
    expect(typeof logger.warn).toBe('function');
  });
});

describe('auditLog', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when called with required fields', () => {
    expect(() =>
      auditLog({
        action:    'TENANT_CREATED',
        actorId:   'u-001',
        actorRole: 'super_admin',
      }),
    ).not.toThrow();
  });

  it('does not throw when called with all optional fields', () => {
    expect(() =>
      auditLog({
        action:    'TENANT_SUSPENDED',
        actorId:   'u-001',
        actorRole: 'super_admin',
        tenantId:  'tenant-001',
        targetId:  'tenant-002',
        meta:      { reason: 'non-payment' },
      }),
    ).not.toThrow();
  });

  it('calls logger.info with audit: true', () => {
    auditLog({
      action:    'INVITE_CLAIMED',
      actorId:   'u-002',
      actorRole: 'school_admin',
    });

    expect(infoSpy).toHaveBeenCalledOnce();
    const [firstArg] = infoSpy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
    expect(firstArg).toMatchObject({ audit: true });
  });

  it('logs the action name in the message', () => {
    auditLog({
      action:    'LOGIN_SUCCESS',
      actorId:   'u-003',
      actorRole: 'driver',
    });

    const [, message] = infoSpy.mock.calls[0] as [unknown, string];
    expect(message).toContain('LOGIN_SUCCESS');
  });

  it('includes actorId and actorRole in the log object', () => {
    auditLog({
      action:    'ROLE_CHANGED',
      actorId:   'admin-1',
      actorRole: 'super_admin',
      tenantId:  'tenant-99',
    });

    const [firstArg] = infoSpy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
    expect(firstArg).toMatchObject({
      actorId:   'admin-1',
      actorRole: 'super_admin',
      tenantId:  'tenant-99',
    });
  });
});
