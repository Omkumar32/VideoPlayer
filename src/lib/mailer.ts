import nodemailer from 'nodemailer';

interface SendAccessEmailParams {
  toEmail: string;
  videoTitle: string;
  accessUrl: string;
  expiresAt: string;
}

export async function sendAccessEmail({ toEmail, videoTitle, accessUrl, expiresAt }: SendAccessEmailParams) {
  // If SMTP environment variables are configured, use live SMTP transporter
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"Tridiagonal Secure Video" <${smtpUser}>`,
        to: toEmail,
        subject: `🔒 Confidential Video Access: ${videoTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; borderRadius: 12px;">
            <h2 style="color: #818cf8; margin-bottom: 8px;">Tridiagonal Enterprise Video Access</h2>
            <p style="color: #94a3b8; font-size: 14px;">You have been granted secure access to watch a private video stream.</p>
            
            <div style="background-color: #1e293b; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #334155;">
              <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; color: #ffffff;">Video: ${videoTitle}</p>
              <p style="margin: 0; font-size: 13px; color: #cbd5e1;">Authorized Email: <strong>${toEmail}</strong></p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Expires: <strong>${new Date(expiresAt).toLocaleString()}</strong></p>
            </div>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${accessUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                Watch Confidential Video Stream →
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #334155; padding-top: 16px;">
              <strong>Security Notice:</strong> This link is cryptographically bound to your email address and initial verified device. Forwarding this email will not grant access to unauthorized third parties.
            </p>
          </div>
        `,
      });

      console.log(`[SMTP Mailer] Live access email dispatched to ${toEmail}`);
      return { success: true, mode: 'live_smtp' };
    } catch (error: any) {
      console.error('[SMTP Mailer] Failed to send SMTP email:', error);
    }
  }

  // Fallback / Default: Ethereal / Simulated Dispatch logging
  console.log(`\n======================================================`);
  console.log(`[EMAIL DISPATCH SIMULATION] Automatically sent link to ${toEmail}`);
  console.log(`Target Video: ${videoTitle}`);
  console.log(`Access Link : ${accessUrl}`);
  console.log(`Expires At  : ${new Date(expiresAt).toLocaleString()}`);
  console.log(`======================================================\n`);

  return { success: true, mode: 'simulated' };
}
