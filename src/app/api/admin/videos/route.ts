import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { dbStore } from '@/lib/db';

export async function GET() {
  const videos = await dbStore.getVideos();
  return NextResponse.json({ success: true, videos });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || '';
    const file = formData.get('file') as File | null;
    const existingStorageKey = formData.get('storageKey') as string | null;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Video title is required.' },
        { status: 400 }
      );
    }

    let finalStorageKey = existingStorageKey || '';
    let fileSizeStr = '15.0 MB';

    // If actual MP4 file is uploaded
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Clean filename
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${Date.now()}_${safeName}`;
      
      // Vercel serverless functions have a read-only filesystem except /tmp
      const isServerless = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
      let targetDir = isServerless 
        ? path.join('/tmp', 'videos') 
        : path.join(process.cwd(), 'public', 'videos');

      if (!fs.existsSync(targetDir)) {
        try {
          fs.mkdirSync(targetDir, { recursive: true });
        } catch (e) {
          targetDir = path.join('/tmp', 'videos');
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
        }
      }

      const filePath = path.join(targetDir, filename);
      await writeFile(filePath, buffer);
      finalStorageKey = filename;

      // Format size
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      fileSizeStr = `${mb} MB`;
    }

    if (!finalStorageKey) {
      return NextResponse.json(
        { success: false, error: 'Please upload a video file or select a sample file.' },
        { status: 400 }
      );
    }

    const video = await dbStore.addVideo({
      title,
      description,
      storageKey: finalStorageKey,
      createdBy: 'admin@tridiagonal.com',
      duration: '03:30',
      fileSize: fileSizeStr,
    });

    return NextResponse.json({ success: true, video });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, description, storageKey } = body;

    if (!id || !title) {
      return NextResponse.json({ success: false, error: 'Video ID and Title required.' }, { status: 400 });
    }

    await dbStore.updateVideo(id, { title, description, storageKey });
    return NextResponse.json({ success: true, message: 'Video updated successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Video ID required.' }, { status: 400 });
    }

    await dbStore.deleteVideo(id);
    return NextResponse.json({ success: true, message: 'Video deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
