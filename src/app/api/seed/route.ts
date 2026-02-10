import { NextResponse } from 'next/server';
import { seedServices } from '@/app/actions/services';

export async function GET() {
    const result = await seedServices();
    return NextResponse.json(result);
}
