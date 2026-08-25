import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { sendAccessEmail } from '@/lib/mailer';

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
    const { videoId, videoIds, userEmail, expiresAt, maxViews } = body;

    // Support single videoId or array of videoIds
    const selectedIds: string[] = Array.isArray(videoIds) && videoIds.length > 0 
      ? videoIds 
      : (videoId ? [videoId] : []);

    if (selectedIds.length === 0 || !userEmail || !expiresAt) {
      return NextResponse.json(
        { success: false, error: 'At least one Video, User Email, and Expiration Date are required.' },
        { status: 400 }
      );
    }

    const createdLinks = [];
    const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/+$/, '') || 'http://localhost:3000';

    for (const vId of selectedIds) {
      let video = await dbStore.getVideoById(vId);
      // Fallback: if single video exists or vId mismatch, match against videos list
      if (!video) {
        const allVids = await dbStore.getVideos();
        video = allVids.find((v: any) => v.id === vId || v._id?.toString() === vId) || allVids[0];
      }
      if (!video) continue;

      const targetVideoId = video.id || video._id?.toString() || vId;

      const { record, rawToken } = await dbStore.createAccessRecord({
        videoId: targetVideoId,
        userEmail,
        expiresAt: new Date(expiresAt).toISOString(),
        maxViews: maxViews ? parseInt(maxViews, 10) : null,
      });

      const fullAccessUrl = `${origin}/watch/${rawToken}`;

      // Automatically Dispatch Email to Target Recipient (Non-blocking)
      try {
        await sendAccessEmail({
          toEmail: record.userEmail,
          videoTitle: video.title,
          accessUrl: fullAccessUrl,
          expiresAt: record.expiresAt,
        });
      } catch (mailErr) {
        console.warn('Mail dispatch skipped or errored:', mailErr);
      }

      await dbStore.addLog({
        accessRecordId: record.id,
        videoId: video.id || video._id,
        userEmail: record.userEmail,
        event: 'LINK_OPENED',
        ipAddress: 'CMS Admin Panel',
        userAgent: 'Admin Console',
        details: `Generated secure token link & dispatched email to ${record.userEmail}`,
      });

      createdLinks.push({
        videoId: vId,
        videoTitle: video.title,
        accessUrl: `/watch/${rawToken}`,
        fullAccessUrl,
        rawToken,
        record,
      });
    }

    return NextResponse.json({
      success: true,
      count: createdLinks.length,
      links: createdLinks,
      accessUrl: createdLinks[0]?.accessUrl,
      rawToken: createdLinks[0]?.rawToken,
      message: `Generated link and automatically dispatched email to ${userEmail}!`,
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
