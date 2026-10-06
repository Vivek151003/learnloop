import {
  adminUpdateUserSchema,
  adminUserQuerySchema,
  auditQuerySchema,
  idParamSchema,
} from '@learnloop/shared';
import { ApiModule } from '../lib/route.js';
import { listAudit, verifyAuditChain } from '../services/audit.js';
import * as users from '../services/users.js';

export const adminModule = new ApiModule('/admin', 'Admin');
adminModule
  .route(
    {
      method: 'get',
      path: '/users',
      summary: 'List users',
      access: ['admin'],
      query: adminUserQuerySchema,
    },
    ({ query: { page, pageSize, ...filter } }) => users.listUsers(filter, { page, pageSize }),
  )
  .route(
    {
      method: 'patch',
      path: '/users/:id',
      summary: 'Change role or disable a user',
      access: ['admin'],
      params: idParamSchema,
      body: adminUpdateUserSchema,
    },
    ({ user, params, body }) => users.adminUpdateUser(params.id, user, body),
  )
  .route(
    {
      method: 'get',
      path: '/audit',
      summary: 'Audit log',
      access: ['admin'],
      query: auditQuerySchema,
    },
    ({ query: { page, pageSize, ...filter } }) => listAudit(filter, { page, pageSize }),
  )
  .route(
    {
      method: 'get',
      path: '/audit/verify',
      summary: 'Verify the audit log hash chain',
      access: ['admin'],
    },
    () => verifyAuditChain(),
  );
