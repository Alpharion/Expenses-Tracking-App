'use client'
import type { Transaction } from '@/lib/types'

export default function SummaryCards({trans}: {trans: Transaction[]}) {
    const inflow = trans.filter(t => t.type === "inflow")
                        .map(t => t.transaction_amount)
                        .reduce((prev, curr) => prev + curr, 0)
    const outflow = trans.filter(t => t.type === "outflow")
                         .map(t => t.transaction_amount)
                         .reduce((prev, curr) => prev + curr, 0)
    const net = inflow - outflow

    return (
        <div className="flex flex-col gap-2 px-2 py-3">
            
            <div className="bg-white rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400">Net</p>
                <p className={`font-bold ${net >= 0 ? "text-green-300" : "text-red-300"}`}>
                    {net >= 0 ? "+" : "-"}S${Math.abs(net).toFixed(2)}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400">In</p>
                    <p className="font-bold text-green-500">S${inflow.toFixed(2)}</p>
                </div>

                <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400">Out</p>
                    <p className="font-bold text-red-400">S${outflow.toFixed(2)}</p>
                </div>
            </div>
        </div>
    )
}
