import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function GET() {
  const logs = await dbStore.getLogs(100);
  return NextResponse.json({ success: true, logs });
}
