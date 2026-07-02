import {auth} from "@/lib/auth"
import { getValidAccessToken, fetchDBSEmails } from "@/lib/gmail"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { classifyBatch } from "@/lib/groq"

export async function POST(_request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({error: "Invalid Credentials"}, {status: 401})

        const accessToken = await getValidAccessToken(session.accessToken, session.refreshToken, session.expiresAt)

        const emails = await fetchDBSEmails(accessToken)
        const parsedTransactions = await classifyBatch(emails)

        const {error} = await supabaseAdmin.from("transactions").upsert(
            parsedTransactions, {
                onConflict: "gmail_message_id",
                ignoreDuplicates: true
            }
        )

        if (error) throw error
        return NextResponse.json({ synced: parsedTransactions.length, total: emails.length})
    } catch (error) {
        return NextResponse.json({error: error}, {status: 400})
    }
}