'use client'
import { useState } from "react";

export default function SyncButton({ fn }: { fn: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function handleSync() {
    try {
      setSyncing(true);
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
      });
      if (!res.ok) {
        setError("Error fetching emails from gmail API");
        throw Error("Cannot fetch emails");
      }
      const data = await res.json();
      setResult(
        `Successfully synced ${data.synced} transactions from ${data.total} emails.`,
      );
      fn();
    } catch (error) {
      setResult("");
    } finally {
        setSyncing(false)
    }
  }

  return (
    <div className="bg-white flex flex-col gap-1">
      <button className="w-full bg-red-600 text-white rounded-xl py-2.6 font-semibold text-sm disabled:opacity-50" disabled={syncing} onClick={handleSync}>
        {syncing ? "Syncing..." : "Sync Emails"}
      </button>
      {result && <p className="text-slate-400 font-xs">{result}</p>}
      {error && <p className="text-red-500 font-xs">{error}</p>}
    </div>
  );
}
