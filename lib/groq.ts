import Groq from "groq-sdk";
import type {
  EmailData,
  ParsedTransaction,
  Category,
  TransactionType,
} from "@/lib/types";
import { stripHtml } from "@/lib/gmail";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
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
- Money you RECEIVE (someone pays you, salary, refunds credited to your account) = "inflow"
- Money you SPEND (purchases, PayLah payments to merchants, PayNow transfers you initiate) = "outflow"
- If "From" is your PayLah! Wallet or your bank account = "outflow"
- If "To" is a merchant, hawker, or business = "outflow"
- "Scan & Pay", "PayLah! Transfer", "payment completed" always = "outflow"
- Only mark "inflow" if money was explicitly credited TO your account FROM someone else
- Emails with subject "Transaction Alerts" or "iBanking Alerts" always contain a transaction — never skip
- Only return {"skip": true} for promotional emails, marketing, or monthly statements

Examples:
- From: PayLah! Wallet, To: MIXED RICE → outflow, Food
- From: PayLah! Wallet, To: YANG GUO FU → outflow, Food
- S$500 credited to your account → inflow, Other
- Salary credited → inflow, Other`;

export async function classifyTransaction(
  email: EmailData,
): Promise<ParsedTransaction | null> {
  const userMessage = `Email subject: ${email.email_subject}
    Email date: ${email.email_date}
    Email body: ${stripHtml(email.email_body).slice(0, 3000)}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
      max_tokens: 256,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(raw);
    if (parsed.skip) {
      console.log(`Skipped email: ${email.email_subject}`);
      return null;
    }

    return {
      gmail_message_id: email.email_id,
      transaction_id: parsed.transaction_id,
      transaction_timestamp: parsed.transaction_timestamp,
      transaction_amount: parsed.transaction_amount,
      type: parsed.type as TransactionType,
      merchant: parsed.merchant,
      from_acc: parsed.from_acc,
      to_acc: parsed.to_acc,
      raw_snippet: email.email_body.slice(0, 200),
      category: parsed.category as Category,
    };
  } catch (error) {
    console.error(`Failed to classify email ${email.email_id}`, error);
    return null;
  }
}

export async function classifyBatch(
  emails: EmailData[],
): Promise<ParsedTransaction[]> {
  const results: ParsedTransaction[] = [];
  for (let i = 0; i < emails.length; i += 2) {
    const batch = emails.slice(i, i + 2);
    const batchResults = await Promise.all(batch.map(classifyTransaction));
    results.push(
      ...batchResults.filter((r): r is ParsedTransaction => r !== null),
    );
    if (i + 2 < emails.length) {
      await new Promise((r) => setTimeout(r, 15000));
    }
  }
  return results;
}
