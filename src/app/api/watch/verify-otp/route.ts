import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { hashToken } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email, otpCode, deviceFingerprint, deviceInfo } = body;

    if (!token || !email || !otpCode || !deviceFingerprint) {
      return NextResponse.json({ success: false, error: 'Token, Email, OTP Code, and Device Fingerprint are required.' }, { status: 400 });
    }

    const hashed = hashToken(token);
    const accessRecord = await dbStore.getAccessRecordByTokenHash(hashed);

    if (!accessRecord) {
      return NextResponse.json({ success: false, error: 'Invalid token.' }, { status: 404 });
    }

    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // Verify OTP code
    const otpResult = await dbStore.verifyOTP(accessRecord.id, otpCode);
    if (!otpResult.success) {
      return NextResponse.json({ success: false, error: otpResult.message }, { status: 400 });
    }

    // Bind Device Fingerprint & Info
    await dbStore.updateAccessRecord(accessRecord.id, {
      registeredDeviceFingerprint: deviceFingerprint,
      registeredDeviceInfo: {
        userAgent: deviceInfo?.userAgent || userAgent,
        screenResolution: deviceInfo?.screenResolution || 'Unknown',
        boundAt: new Date().toISOString(),
      },
      lastAccessedAt: new Date().toISOString(),
    });

    await dbStore.addLog({
      accessRecordId: accessRecord.id,
      videoId: accessRecord.videoId,
      userEmail: accessRecord.userEmail,
      event: 'OTP_VERIFIED',
      ipAddress: clientIp,
      userAgent,
      deviceFingerprint,
      details: 'OTP successfully verified. Device registered and bound.',
    });

    await dbStore.addLog({
      accessRecordId: accessRecord.id,
      videoId: accessRecord.videoId,
      userEmail: accessRecord.userEmail,
      event: 'DEVICE_BOUND',
      ipAddress: clientIp,
      userAgent,
      deviceFingerprint,
      details: `Bound device fingerprint: ${deviceFingerprint}`,
    });

    const video = await dbStore.getVideoById(accessRecord.videoId);

    // Create session cookie response
    const response = NextResponse.json({
      success: true,
      authenticated: true,
      videoTitle: video?.title,
      videoDescription: video?.description,
      message: 'Device verified & bound successfully!',
    });

    // Set secure auth cookie
    response.cookies.set(`video_auth_${accessRecord.id}`, deviceFingerprint, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
