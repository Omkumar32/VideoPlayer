import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { hashToken } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email, deviceFingerprint, deviceInfo } = body;

    if (!token || !email) {
      return NextResponse.json({ success: false, error: 'Token and Email are required.' }, { status: 400 });
    }

    const hashed = hashToken(token);
    const accessRecord = await dbStore.getAccessRecordByTokenHash(hashed);

    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (!accessRecord) {
      return NextResponse.json({ success: false, error: 'Invalid or missing secure token.' }, { status: 404 });
    }

    const video = await dbStore.getVideoById(accessRecord.videoId);

    // 1. Check expiration
    if (new Date() > new Date(accessRecord.expiresAt) || accessRecord.status === 'expired') {
      await dbStore.updateAccessRecord(accessRecord.id, { status: 'expired' });
      await dbStore.addLog({
        accessRecordId: accessRecord.id,
        videoId: accessRecord.videoId,
        userEmail: email,
        event: 'EXPIRED_BLOCKED',
        ipAddress: clientIp,
        userAgent,
        details: 'Attempted to access an expired link',
      });
      return NextResponse.json({
        success: false,
        error: 'This secure link has expired. Please contact your administrator.',
        status: 'expired',
      }, { status: 403 });
    }

    // 2. Check revoked status
    if (accessRecord.status === 'revoked') {
      await dbStore.addLog({
        accessRecordId: accessRecord.id,
        videoId: accessRecord.videoId,
        userEmail: email,
        event: 'REVOKED_BLOCKED',
        ipAddress: clientIp,
        userAgent,
        details: 'Attempted to access a revoked link',
      });
      return NextResponse.json({
        success: false,
        error: 'Access to this video link has been revoked by the administrator.',
        status: 'revoked',
      }, { status: 403 });
    }

    // 3. Check Max Views limit
    if (accessRecord.maxViews !== null && accessRecord.viewCount >= accessRecord.maxViews) {
      await dbStore.addLog({
        accessRecordId: accessRecord.id,
        videoId: accessRecord.videoId,
        userEmail: email,
        event: 'MAX_VIEWS_EXCEEDED',
        ipAddress: clientIp,
        userAgent,
        details: `Max views limit of ${accessRecord.maxViews} reached. Current views: ${accessRecord.viewCount}`,
      });
      return NextResponse.json({
        success: false,
        error: `Maximum view limit (${accessRecord.maxViews}) has been reached for this link.`,
        status: 'max_views_exceeded',
      }, { status: 403 });
    }

    // 4. Verify User Email Match
    const cleanInputEmail = email.toLowerCase().trim();
    if (cleanInputEmail !== accessRecord.userEmail) {
      await dbStore.addLog({
        accessRecordId: accessRecord.id,
        videoId: accessRecord.videoId,
        userEmail: cleanInputEmail,
        event: 'EMAIL_MISMATCH',
        ipAddress: clientIp,
        userAgent,
        details: `Access denied. Input email (${cleanInputEmail}) does not match authorized email (${accessRecord.userEmail}).`,
      });

      return NextResponse.json({
        success: false,
        authorized: false,
        error: `Access Denied: The email "${cleanInputEmail}" is not authorized for this video link.`,
      }, { status: 403 });
    }

    // 5. Check if device is ALREADY bound to this exact device
    if (
      accessRecord.registeredDeviceFingerprint &&
      accessRecord.registeredDeviceFingerprint === deviceFingerprint
    ) {
      // Direct access allowed without re-OTP!
      await dbStore.updateAccessRecord(accessRecord.id, {
        lastAccessedAt: new Date().toISOString(),
      });

      await dbStore.addLog({
        accessRecordId: accessRecord.id,
        videoId: accessRecord.videoId,
        userEmail: cleanInputEmail,
        event: 'VIDEO_STREAM_ACCESSED',
        ipAddress: clientIp,
        userAgent,
        deviceFingerprint,
        details: 'Recognized bound device. Direct access granted.',
      });

      return NextResponse.json({
        success: true,
        authorized: true,
        alreadyBoundDevice: true,
        videoTitle: video?.title,
        videoDescription: video?.description,
      });
    }

    // 6. If device is bound to a DIFFERENT device fingerprint
    if (
      accessRecord.registeredDeviceFingerprint &&
      accessRecord.registeredDeviceFingerprint !== deviceFingerprint
    ) {
      await dbStore.addLog({
        accessRecordId: accessRecord.id,
        videoId: accessRecord.videoId,
        userEmail: cleanInputEmail,
        event: 'DEVICE_MISMATCH_BLOCKED',
        ipAddress: clientIp,
        userAgent,
        deviceFingerprint,
        details: `Device mismatch! Token is registered to a different device (${accessRecord.registeredDeviceInfo?.userAgent || 'Unknown Device'}).`,
      });

      return NextResponse.json({
        success: false,
        deviceBlocked: true,
        error: 'Access Denied: This link is bound to another verified device. Contact your admin to reset device authorization.',
      }, { status: 403 });
    }

    // 7. Email matches & device needs initial activation -> Generate and send OTP!
    const otpCode = await dbStore.createOTP(accessRecord.id, cleanInputEmail);

    await dbStore.addLog({
      accessRecordId: accessRecord.id,
      videoId: accessRecord.videoId,
      userEmail: cleanInputEmail,
      event: 'OTP_SENT',
      ipAddress: clientIp,
      userAgent,
      deviceFingerprint,
      details: `OTP generated and sent to ${cleanInputEmail}`,
    });

    return NextResponse.json({
      success: true,
      requiresOTP: true,
      userEmail: cleanInputEmail,
      videoTitle: video?.title,
      // Provide simulated OTP code in response for instant developer / user testing UI display
      simulatedOTP: otpCode,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
