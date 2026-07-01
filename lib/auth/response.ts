import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import AuditLog, { AuditAction } from '@/models/Auditlog';

// ─── Standard API response shapes ────────────────────────────────────────────
// Every route returns one of these — no ad-hoc response objects.

type SuccessResponse<T> = {
  ok: true;
  data: T;
};

type ErrorResponse = {
  ok: false;
  error: string;
  details?: unknown;
};

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// ─── Response factories ───────────────────────────────────────────────────────

export const ok = <T>(data: T, status = 200): NextResponse<ApiResponse<T>> =>
  NextResponse.json({ ok: true, data }, { status });

export const err = (
  error: string,
  status: number,
  details?: unknown
): NextResponse<ApiResponse<never>> => NextResponse.json({ ok: false, error, details }, { status });

// ─── Validation error helper ─────────────────────────────────────────────────
// Unwraps Zod errors into a flat field → message map.

export const validationErr = (issues: { path: (string | number)[]; message: string }[]) =>
  err(
    'Validation failed',
    422,
    Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]))
  );

// ─── Request metadata ─────────────────────────────────────────────────────────
// Extract IP and user-agent from a Next.js request — used for audit logs.

export const requestMeta = (req: NextRequest) => ({
  ipAddress:
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null,
  userAgent: req.headers.get('user-agent') ?? null,
});

// ─── Audit log writer ─────────────────────────────────────────────────────────
// Fire-and-forget — never let audit failures break the main flow.
// We deliberately do not await this in request handlers; if it fails the
// auth action already succeeded and the user should not be penalised.

type AuditParams = {
  userId?: Types.ObjectId | null;
  actorId?: Types.ObjectId | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const writeAuditLog = (params: AuditParams): void => {
  AuditLog.create({
    userId: params.userId ?? null,
    actorId: params.actorId ?? params.userId ?? null,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    oldValues: params.oldValues ?? null,
    newValues: params.newValues ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    metadata: params.metadata ?? null,
  }).catch((auditErr: unknown) => {
    // Log to server console but do not surface to client
    console.error('[AuditLog] write failed:', auditErr);
  });
};
