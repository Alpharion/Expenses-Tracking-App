'use client'
import { format, subMonths } from "date-fns"
import type { FilterState, Category, TransactionType } from "@/lib/types"

const CATEGORIES: Category[] = ["Food", "Transport", "Shopping", "Paynow", "Activities", "Travel", "Other"]

export default function FilterBar( {filter, onChange}: {filter: FilterState, onChange: (f: FilterState) => void}) {

    const months = Array.from({length: 12}, (_, i) => {
        const date = subMonths(new Date(), i)
        return {
            value: format(date, "yyyy-MM"),
            label: format(date, "MMM yyyy")
        }
    })

    const selectClass = "flex-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"

    return (
        <div className="flex gap-2">
            <select value={filter.month} onChange={e => onChange({...filter, month: e.target.value})} className={selectClass}>
                <option value="">All months</option>
                {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                ))}
            </select>

            <select value={filter.category} onChange={e => onChange({...filter, category: e.target.value as Category | ""})} className={selectClass}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                ))}
            </select>

            <select value={filter.type} onChange={e => onChange({...filter, type: e.target.value as TransactionType | ""})} className={selectClass}>
                <option value="">All</option>
                <option value="inflow">Inflow</option>
                <option value="outflow">Outflow</option>
            </select>
        </div>
    )
}