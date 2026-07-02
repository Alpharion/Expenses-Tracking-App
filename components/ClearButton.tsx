"use client";
import type { FilterState } from "@/lib/types";
import { useState } from "react";

export default function ClearButton({
  filter,
  onClear,
}: {
  filter: FilterState;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function handleClear() {
    if (!confirming) {
      setConfirming(true);
      return;
    } else {
      const params = new URLSearchParams();
      if (filter.month) params.set("month", filter.month);
      if (filter.category) params.set("category", filter.category);
      if (filter.type) params.set("type", filter.type);
      const res = await fetch(`/api/transactions?${params}`, {
        method: "DELETE",
      });

      if (!res.ok) setError("Error deleting transactions.");
      onClear();
    }
  }

  return (
    <>
    {error && <p className="text-red-500 text-xs">{error}</p>}
    <button
      onClick={handleClear}
      onBlur={() => setConfirming(false)}
      className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 font-semibold text-sm"
    >
      {confirming ? "Tap again to confirm" : "Clear filtered"}
    </button>
    </>
  );
}
