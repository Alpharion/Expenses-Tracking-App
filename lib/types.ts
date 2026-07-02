
export type TransactionType = 'inflow' | 'outflow'
export type Category = "Food" | "Transport" | "Shopping" | "Paynow" | "Activities" | "Travel" | "Other"

export interface EmailData {
    email_id: string,
    email_date: string,
    email_subject: string,
    email_body: string
}

export interface ParsedTransaction {
    gmail_message_id: string,
    transaction_id: string | null,
    transaction_timestamp: Date,
    transaction_amount: number,
    category: Category,
    type: TransactionType,
    merchant: string | null,
    from_acc: string | null,
    to_acc: string | null,
    raw_snippet: string,
}

export interface Transaction extends ParsedTransaction {
    id: string,
    created_at: Date
}

export interface FilterState {
    month: string,
    category: Category | "",
    type: TransactionType | ""
}