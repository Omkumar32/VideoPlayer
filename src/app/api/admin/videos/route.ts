import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function GET() {
  const videos = await dbStore.getVideos();
  return NextResponse.json({ success: true, videos });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, storageKey } = body;

    if (!title || !storageKey) {
      return NextResponse.json(
        { success: false, error: 'Title and video file selection are required.' },
        { status: 400 }
      );
    }

    const video = await dbStore.addVideo({
      title,
      description: description || '',
      storageKey,
      createdBy: 'admin@tridiagonal.com',
      duration: '03:15',
      fileSize: '18.5 MB',
    });

    return NextResponse.json({ success: true, video });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
