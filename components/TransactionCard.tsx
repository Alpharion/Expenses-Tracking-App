'use client'
import type { Transaction } from "@/lib/types"

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍜",
  Transport: "🚇",
  Shopping: "🛍️",
  Paynow: "💸",
  Activities: "🎬",
  Travel: "✈️",
  Other: "📦",
}

export default function TransactionCard({ t }: { t: Transaction }) {
    return (
        <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
            <span className="text-2xl">
                {CATEGORY_EMOJI[t.category] ?? "📦"}
            </span>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{t.merchant ?? t.raw_snippet}</p>
                <p className="text-xs text-gray-400">
                    {t.category} . {new Date(t.transaction_timestamp).toLocaleDateString()}
                </p>
            </div>
            <p className={`font-semibold text-sm ${t.type==="inflow" ? "text-green-600" : "text-red-600"}`}>
                {t.type === "inflow" ? "+" : "-"}S${t.transaction_amount.toFixed(2)}
            </p>
        </div>
    )
}   