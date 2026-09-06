import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export type LogLevel = 'critical' | 'error' | 'warning' | 'info';
export type LogSource = 'backend' | 'frontend' | 'database' | 'email' | 'auth';

export const APP_VERSION = 'v2.2';

export function getAppCommit(): string {
  const envCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  if (envCommit) {
    return envCommit.substring(0, 7);
  }
  return '63f37a5';
}

export interface SystemLog {
  id: string;
  level: LogLevel;
  source: LogSource;
  action: string;
  message: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
  userAgent?: string;
  ip?: string;
  version?: string;
  commit?: string;
  createdAt: Date;
  resolved: boolean;
}

export async function logSystemEvent(params: {
  level: LogLevel;
  source: LogSource;
  action: string;
  message: string;
  error?: unknown;
  metadata?: Record<string, any>;
  userAgent?: string;
  ip?: string;
  version?: string;
  commit?: string;
}): Promise<string | null> {
  try {
    let stackTrace: string | undefined = undefined;
    let finalMessage = params.message;

    if (params.error instanceof Error) {
      stackTrace = params.error.stack;
      if (!finalMessage) {
        finalMessage = params.error.message;
      }
    } else if (typeof params.error === 'string') {
      stackTrace = params.error;
    } else if (params.error && typeof params.error === 'object') {
      stackTrace = JSON.stringify(params.error, null, 2);
    }

    const payload = {
      level: params.level,
      source: params.source,
      action: params.action,
      message: finalMessage || 'Error no especificado',
      stackTrace: stackTrace || null,
      metadata: params.metadata || {},
      userAgent: params.userAgent || 'Server',
      ip: params.ip || '127.0.0.1',
      version: params.version || APP_VERSION,
      commit: params.commit || getAppCommit(),
      createdAt: Timestamp.now(),
      resolved: false,
    };

    const docRef = await addDoc(collection(db, 'system_logs'), payload);
    return docRef.id;
  } catch (loggingError) {
    // Failsafe: Never crash the main app if telemetry logging fails
    console.error('[TELEMETRY FAILURE]', loggingError);
    return null;
  }
}
