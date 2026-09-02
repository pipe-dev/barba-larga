import { NextRequest, NextResponse } from 'next/server';
import { logSystemEvent } from '@/lib/telemetry';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userAgent = req.headers.get('user-agent') || 'Unknown browser';
    const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1';

    await logSystemEvent({
      level: body.level || 'error',
      source: 'frontend',
      action: body.action || 'clientError',
      message: body.message || 'Error en el cliente',
      error: body.stackTrace || body.error,
      metadata: body.metadata || {},
      userAgent,
      ip: rawIp.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
