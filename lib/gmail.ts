import { google } from "googleapis"
import type { EmailData } from "@/lib/types"
import type { gmail_v1 } from "googleapis"

export async function getValidAccessToken(accessToken: string, refreshToken: string, expiresAt: number) : Promise<string> {
    if (Date.now() / 1000 < expiresAt - 60) {
        return accessToken
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        })
    })

    const data = await res.json()
    return data.access_token
}

export async function fetchDBSEmails(accessToken: string): Promise<EmailData[]> {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth})

    const listRes = await gmail.users.messages.list({
        userId: "me",
        q: "from:@dbs.com",
        maxResults: 100,
    })

    const messages = listRes.data.messages ?? []
    const emails: EmailData[] = []

    for (const msg of messages) {
        const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "full",
        })
        emails.push({
            email_id: msg.id!,
            email_date: extractHeader(detail.data.payload?.headers, "Date") ?? "",
            email_subject: extractHeader(detail.data.payload?.headers, "Subject") ?? "",
            email_body: detail.data.payload ? extractBody(detail.data.payload) : "",
        })
    }
    return emails
}

function extractHeader(
    headers: { name?: string | null; value?: string | null}[] | undefined,
    name: string
): string | null {
    return headers?.find(h => h.name === name)?.value ?? null
}

export function stripHtml(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function extractBody(payload: gmail_v1.Schema$MessagePart): string {
    if (!payload) return ""
    if (payload.body?.data) {
        return Buffer.from(payload.body.data, "base64url").toString("utf-8")
    }
    if (payload.parts) {
        const plain = payload.parts.find((p: gmail_v1.Schema$MessagePart) => p.mimeType === "text/plain")
        const html = payload.parts.find((p: gmail_v1.Schema$MessagePart) => p.mimeType === "text/html")
        const target = plain ?? html
        if (target?.body?.data) {
            return Buffer.from(target.body.data, "base64url").toString("utf-8")
        }
        for (const part of payload.parts) {
            const nested = extractBody(part)
            if (nested) return nested
        }
    }
    return ""
}