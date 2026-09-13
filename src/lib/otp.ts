import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  // Mongolian numbers: 8 digits local, or 976 + 8 digits
  if (/^\d{8}$/.test(d)) return `+976${d}`;
  if (/^976\d{8}$/.test(d)) return `+${d}`;
  if (/^\+\d{8,15}$/.test(raw)) return raw;
  if (/^\d{11,12}$/.test(d) && d.startsWith("976")) return `+${d}`;
  // Already +976xxxxxxxx
  if (raw.startsWith("+") && d.length >= 11) return `+${d}`;
  return null;
}

export function generateCode(): string {
  return String(randomInt(100000, 1000000)); // 6 digits
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export async function sendSms(phone: string, code: string): Promise<{ mocked: boolean; messageId?: string }> {
  // Twilio (preferred) — plain REST, no SDK needed.
  // Needs: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (your Twilio number).
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM;
  if (twilioSid && twilioToken && twilioFrom) {
    const form = new URLSearchParams({ To: phone, From: twilioFrom, Body: `Lexlab kod: ${code} (5 min)` });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!r.ok) throw new Error(`Twilio ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = (await r.json()) as { sid?: string };
    return { mocked: false, messageId: d.sid };
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  // mock if no credentials — useful for dev / Vercel without SMS setup
  if (!accessKeyId || !secretAccessKey) {
    console.log(`[OTP mock] ${phone} -> ${code}`);
    return { mocked: true };
  }

  const client = new SNSClient({ region, credentials: { accessKeyId, secretAccessKey } });
  const res = await client.send(
    new PublishCommand({
      PhoneNumber: phone,
      Message: `Lexlab код: ${code} (5 мин хүчинтэй)`,
      MessageAttributes: {
        "AWS.SNS.SMS.SenderID": { DataType: "String", StringValue: process.env.SNS_SENDER_ID || "Lexlab" },
        "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
      },
    })
  );
  return { mocked: false, messageId: res.MessageId };
}

export const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
export const OTP_RATE_LIMIT_SECONDS = 60; // 1 req / minute per phone
export const OTP_MAX_ATTEMPTS = 5;
