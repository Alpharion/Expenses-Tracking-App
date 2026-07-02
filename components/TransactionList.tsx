import type { Transaction } from "@/lib/types"
import TransactionCard from "@/components/TransactionCard"

export default function TransactionList({lst, loading} : {lst: Transaction[], loading: boolean}) {
    if (loading) return <span className="text-slate-400">Loading...</span>
    if (lst.length === 0) return <span className="text-slate-400">No Transactions Found.</span>
    return (
        <div className="flex flex-col gap-2 items-center px-3 py-4">
            {lst.map(t => (
                <TransactionCard key={t.id} t={t}/>
            ))}
        </div>
    )
}