export function getClientFingerprint(): { fingerprint: string; info: { userAgent: string; screenResolution: string } } {
  if (typeof window === 'undefined') {
    return {
      fingerprint: 'server_environment',
      info: { userAgent: 'Server', screenResolution: '0x0' },
    };
  }

  // Get client-side persistent device UUID or create it
  let deviceId = localStorage.getItem('secure_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('secure_device_id', deviceId);
  }

  const userAgent = navigator.userAgent;
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  
  // Simple deterministic client hash
  const rawString = `${deviceId}|${userAgent}|${screenResolution}`;
  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  return {
    fingerprint: 'fp_' + Math.abs(hash).toString(16) + '_' + deviceId.substring(0, 8),
    info: {
      userAgent,
      screenResolution,
    },
  };
}
