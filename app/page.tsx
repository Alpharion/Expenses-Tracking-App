"use client";
import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { format } from "date-fns";
import type { FilterState, Transaction } from "@/lib/types";
import FilterBar from "@/components/FilterBar";
import SummaryCards from "@/components/SummaryCards";
import TransactionList from "@/components/TransactionList";
import SyncButton from "@/components/SyncButton";
import ClearButton from "@/components/ClearButton";

export default function Home() {
  const { data: session, status } = useSession();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    month: format(new Date(), "yyyy-MM"),
    category: "",
    type: "",
  });
  const [loading, setLoading] = useState(false);

  async function fetchTransactions() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.month)    params.set("month", filters.month);
    if (filters.category) params.set("category", filters.category);
    if (filters.type)     params.set("type", filters.type);
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    if (Array.isArray(data)) setTransactions(data);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTransactions(); }, [filters]);

  if (status === "loading") return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  if (!session) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-6">
      <h1 className="text-3xl font-bold text-red-600">DBS Expenses</h1>
      <p className="text-gray-500 text-center">Track your DBS transactions automatically from Gmail.</p>
      <button
        onClick={() => signIn("google")}
        className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold w-full"
      >
        Sign in with Google
      </button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-xl font-bold text-red-600">DBS Expenses</h1>
        <button onClick={() => signOut()} className="text-sm text-gray-400">
          Sign out
        </button>
      </div>
      <SummaryCards trans={transactions} />
      <FilterBar filter={filters} onChange={setFilters} />
      <div className="flex gap-2">
        <SyncButton fn={fetchTransactions} />
        <ClearButton filter={filters} onClear={fetchTransactions} />
      </div>
      <TransactionList lst={transactions} loading={loading} />
    </div>
  );
}
