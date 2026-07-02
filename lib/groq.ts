import Groq from "groq-sdk"
import type { EmailData, ParsedTransaction, Category, TransactionType } from "@/lib/types"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const SYSTEM_PROMPT = `You are a financial data extraction assistant. Given a DBS Bank transaction notification email, extract structured data and return ONLY valid JSON. No explanation, no markdown, no code blocks.

Return exactly this JSON shape:
{
  "transaction_id": <string or null>,
  "transaction_timestamp": <ISO 8601 string YYYY-MM-DDTHH:mm:ss>,
  "transaction_amount": <positive number in SGD>,
  "type": <"inflow" or "outflow">,
  "merchant": <string or null>,
  "from_acc": <string or null>,
  "to_acc": <string or null>,
  "category": <one of: "Food", "Transport", "Shopping", "Paynow", "Activities", "Travel", "Other">
}

Rules:
- Credits, received transfers, salary = "inflow"
- Debits, payments, purchases = "outflow"
- If this is NOT a transaction notification email, return: {"skip": true}
- If this is a monthly statement, return: {"skip": true}`

export async function classifyTransaction(email: EmailData): Promise<ParsedTransaction | null> {
    const userMessage = `Email subject: ${email.email_subject}
    Email date: ${email.email_date}
    Email body: ${email.email_body.slice(0, 3000)}`

    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userMessage },
            ],
            temperature: 0,
            max_tokens: 256
        })

        const raw = completion.choices[0]?.message?.content?.trim() ?? ""
        const parsed = JSON.parse(raw)
        if (parsed.skip) return null

        return {
        gmail_message_id: email.email_id,
        transaction_id:        parsed.transaction_id,
        transaction_timestamp: parsed.transaction_timestamp,
        transaction_amount:    parsed.transaction_amount,
        type:                  parsed.type as TransactionType,
        merchant:              parsed.merchant,
        from_acc:              parsed.from_acc,
        to_acc:                parsed.to_acc,
        raw_snippet:           email.email_body.slice(0, 200),
        category:              parsed.category as Category,
        }
    } catch {
        console.error(`Failed to classify email ${email.email_id}`)
        return null
    }
}

export async function classifyBatch(emails: EmailData[]): Promise<ParsedTransaction[]> {
  const results: ParsedTransaction[] = []
  for (let i = 0; i < emails.length; i += 5) {
    const batch = emails.slice(i, i + 5)
    const batchResults = await Promise.all(batch.map(classifyTransaction))
    results.push(...batchResults.filter((r): r is ParsedTransaction => r !== null))
    if (i + 5 < emails.length) {
      await new Promise(r => setTimeout(r, 10000))
    }
  }
  return results
}