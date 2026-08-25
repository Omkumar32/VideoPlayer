import crypto from 'crypto';

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateDeviceFingerprint(params: {
  userAgent: string;
  screenResolution?: string;
  clientDeviceId?: string;
}): string {
  const str = `${params.userAgent}|${params.screenResolution || ''}|${params.clientDeviceId || ''}`;
  return crypto.createHash('sha256').update(str).digest('hex');
}
