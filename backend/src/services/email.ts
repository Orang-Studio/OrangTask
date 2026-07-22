import { Resend } from 'resend'

// lazily construct Resend only when a key is present the constructor throws without one, and email
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.FROM_EMAIL || 'noreply@oranges.lt'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

// most email clients (Gmail, Outlook) strip inline <svg>, which renders as an empty square
const logoImg = (size = 48) =>
  `<img src="${APP_URL}/icons/icon-192.png" width="${size}" height="${size}" alt="OrangTask"
    style="display: inline-block; border-radius: 12px; border: 0; outline: none; text-decoration: none;" />`

export async function sendMagicLink(email: string, token: string) {
  const url = `${APP_URL}/auth/magic?token=${token}`

  if (!resend) {
    console.log(`[DEV] Magic link for ${email}: ${url}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Sign in to OrangTask',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="margin-bottom: 16px;">${logoImg(48)}</div>
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0;">Sign in to OrangTask</h1>
        </div>
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 32px; text-align: center;">
          Click the button below to sign in. This link expires in 15 minutes.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${url}" style="background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
            Sign in to OrangTask
          </a>
        </div>
        <p style="color: #999; font-size: 13px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          If you didn't request this, you can safely ignore this email.<br>
          This link will expire in 15 minutes.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetCode(email: string, code: string) {
  if (!resend) {
    console.log(`[DEV] Password reset code for ${email}: ${code}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your OrangTask reset code: ${code}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="margin-bottom: 16px;">${logoImg(48)}</div>
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0;">Reset your password</h1>
        </div>
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
          Enter this code in OrangTask to set a new password. It expires in 15 minutes.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 28px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ea580c;">
            ${code}
          </div>
        </div>
        <p style="color: #999; font-size: 13px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          If you didn't request this, you can safely ignore this email, your password won't change.
        </p>
      </div>
    `,
  })
}

export async function sendPinResetCode(email: string, code: string) {
  if (!resend) {
    console.log(`[DEV] PIN reset code for ${email}: ${code}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your OrangTask PIN reset code: ${code}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="margin-bottom: 16px;">${logoImg(48)}</div>
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0;">Reset your app PIN</h1>
        </div>
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
          Enter this code in OrangTask to remove your PIN lock, then set a new one in Settings. It expires in 15 minutes.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 28px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ea580c;">
            ${code}
          </div>
        </div>
        <p style="color: #999; font-size: 13px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          If you didn't request this, you can safely ignore this email, your PIN won't change.
        </p>
      </div>
    `,
  })
}

// generic notification email (assignments, shares, completions, etc.)
export async function sendNotificationEmail(email: string, subject: string, body?: string) {
  if (!resend) {
    console.log(`[DEV] Notification email to ${email}: ${subject}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; margin-top: 0;">${subject}</h2>
        ${body ? `<p style="color: #555; font-size: 15px; line-height: 1.6;">${body}</p>` : ''}
        <a href="${APP_URL}" style="background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 16px;">
          Open OrangTask
        </a>
      </div>
    `,
  })
}

export async function sendTaskDueSoonEmail(email: string, taskTitle: string, dueDate: Date) {
  if (!resend) return

  const formatted = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(dueDate)

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Task due soon: ${taskTitle}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111;">Task due in 1 hour</h2>
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <strong style="color: #ea580c;">${taskTitle}</strong>
          <p style="color: #9a3412; margin: 4px 0 0;">Due: ${formatted}</p>
        </div>
        <a href="${APP_URL}" style="background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 16px;">
          View in OrangTask
        </a>
      </div>
    `,
  })
}
