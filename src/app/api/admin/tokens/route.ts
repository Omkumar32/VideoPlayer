import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function GET() {
  const records = await dbStore.getAllAccessRecords();
  const videos = await dbStore.getVideos();
  
  const enrichedRecords = await Promise.all(
    records.map(async (r: any) => {
      const video = videos.find((v: any) => v.id === r.videoId || (v as any)._id?.toString() === r.videoId);
      const latestOtp = await dbStore.getLatestOTP(r.id);
      return {
        ...r,
        videoTitle: video ? video.title : 'Unknown Video',
        activeOTP: latestOtp || null,
      };
    })
  );

  return NextResponse.json({ success: true, records: enrichedRecords });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, userEmail, expiresAt, maxViews } = body;

    if (!videoId || !userEmail || !expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Video, User Email, and Expiration Date are required.' },
        { status: 400 }
      );
    }

    const video = await dbStore.getVideoById(videoId);
    if (!video) {
      return NextResponse.json({ success: false, error: 'Video not found.' }, { status: 404 });
    }

    const { record, rawToken } = await dbStore.createAccessRecord({
      videoId,
      userEmail,
      expiresAt: new Date(expiresAt).toISOString(),
      maxViews: maxViews ? parseInt(maxViews, 10) : null,
    });

    // Log creation
    await dbStore.addLog({
      accessRecordId: record.id,
      videoId: video.id || video._id,
      userEmail: record.userEmail,
      event: 'LINK_OPENED',
      ipAddress: 'CMS Admin Panel',
      userAgent: 'Admin Console',
      details: `Generated secure token link for ${record.userEmail}`,
    });

    const accessUrl = `/watch/${rawToken}`;

    return NextResponse.json({
      success: true,
      record: {
        ...record,
        videoTitle: video.title,
      },
      rawToken,
      accessUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordId, action } = body;

    if (!recordId || !action) {
      return NextResponse.json({ success: false, error: 'Record ID and Action required.' }, { status: 400 });
    }

    const record = await dbStore.getAccessRecordById(recordId);
    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found.' }, { status: 404 });
    }

    if (action === 'reset_device') {
      await dbStore.resetDeviceBinding(recordId);
      await dbStore.addLog({
        accessRecordId: record.id,
        videoId: record.videoId,
        userEmail: record.userEmail,
        event: 'DEVICE_RESET_BY_ADMIN',
        ipAddress: 'CMS Admin Panel',
        userAgent: 'Admin Console',
        details: 'Admin reset registered device binding. User can re-verify on a new device.',
      });
      return NextResponse.json({ success: true, message: 'Device reset successfully.' });
    }

    if (action === 'revoke') {
      await dbStore.updateAccessRecord(recordId, { status: 'revoked' });
      await dbStore.addLog({
        accessRecordId: record.id,
        videoId: record.videoId,
        userEmail: record.userEmail,
        event: 'REVOKED_BLOCKED',
        ipAddress: 'CMS Admin Panel',
        userAgent: 'Admin Console',
        details: 'Admin manually revoked link access.',
      });
      return NextResponse.json({ success: true, message: 'Link access revoked.' });
    }

    if (action === 'reactivate') {
      await dbStore.updateAccessRecord(recordId, { status: 'active' });
      return NextResponse.json({ success: true, message: 'Link reactivated.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
