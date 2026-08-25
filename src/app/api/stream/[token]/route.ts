import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { dbStore } from '@/lib/db';
import { hashToken } from '@/lib/crypto';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const clientFingerprintHeader = req.headers.get('x-device-fingerprint');

    if (!token) {
      return new NextResponse('Token required', { status: 400 });
    }

    const hashed = hashToken(token);
    const accessRecord = await dbStore.getAccessRecordByTokenHash(hashed);

    if (!accessRecord) {
      return new NextResponse('Access Denied: Invalid Token', { status: 403 });
    }

    // Check expiration
    if (new Date() > new Date(accessRecord.expiresAt) || accessRecord.status !== 'active') {
      return new NextResponse('Access Denied: Link Expired or Revoked', { status: 403 });
    }

    // Check max views
    if (accessRecord.maxViews !== null && accessRecord.viewCount >= accessRecord.maxViews) {
      return new NextResponse('Access Denied: Max Views Exceeded', { status: 403 });
    }

    // Check device binding authorization
    const cookieAuth = req.cookies.get(`video_auth_${accessRecord.id}`)?.value;
    const currentFingerprint = clientFingerprintHeader || cookieAuth;

    if (
      !accessRecord.registeredDeviceFingerprint ||
      (currentFingerprint && currentFingerprint !== accessRecord.registeredDeviceFingerprint)
    ) {
      return new NextResponse('Access Denied: Device Not Authorized', { status: 403 });
    }

    const video = await dbStore.getVideoById(accessRecord.videoId);
    if (!video) {
      return new NextResponse('Video File Not Found', { status: 404 });
    }

    // Check primary public/videos location first, then fallback to writable /tmp/videos for Vercel Serverless
    let filePath = path.join(process.cwd(), 'public', 'videos', video.storageKey);
    if (!fs.existsSync(filePath)) {
      filePath = path.join('/tmp', 'videos', video.storageKey);
    }

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Video stream file missing on server', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.get('range');

    // Increment view count on fresh stream start (when range is 0 or missing)
    if (!range || range.startsWith('bytes=0-')) {
      await dbStore.updateAccessRecord(accessRecord.id, {
        viewCount: accessRecord.viewCount + 1,
        lastAccessedAt: new Date().toISOString(),
      });
      await dbStore.addLog({
        accessRecordId: accessRecord.id,
        videoId: video.id || video._id,
        userEmail: accessRecord.userEmail,
        event: 'VIDEO_STREAM_ACCESSED',
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'VideoPlayer',
        deviceFingerprint: currentFingerprint,
        details: `Serving protected video stream bytes. View count incremented to ${accessRecord.viewCount + 1}`,
      });
    }

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(stream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'video/mp4',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      });
    } else {
      const fileStream = fs.createReadStream(filePath);
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(stream as any, {
        status: 200,
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      });
    }
  } catch (error: any) {
    return new NextResponse(`Streaming error: ${error.message}`, { status: 500 });
  }
}
