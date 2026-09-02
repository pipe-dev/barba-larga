import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export type LogLevel = 'critical' | 'error' | 'warning' | 'info';
export type LogSource = 'backend' | 'frontend' | 'database' | 'email' | 'auth';

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
