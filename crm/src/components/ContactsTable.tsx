"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Contact } from "@/lib/queries";
import {
  STAGE_LABELS,
  STAGES,
  SOURCE_LABELS,
  SOURCES,
  TIER_LABELS,
  TIERS,
  formatGBP,
  formatDate,
} from "@/lib/domain";
import { TierBadge } from "@/components/TierBadge";

type SortKey = "name" | "value_gbp" | "created_at";

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let rows = contacts;
    if (tierFilter !== "all") rows = rows.filter((c) => c.tier === tierFilter);
    if (sourceFilter !== "all") rows = rows.filter((c) => c.source === sourceFilter);
    if (stageFilter !== "all") rows = rows.filter((c) => c.stage === stageFilter);

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "value_gbp") cmp = (a.value_gbp ?? 0) - (b.value_gbp ?? 0);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [contacts, tierFilter, sourceFilter, stageFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={tierFilter} onChange={setTierFilter} label="Tier">
          <option value="all">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select value={sourceFilter} onChange={setSourceFilter} label="Source">
          <option value="all">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select value={stageFilter} onChange={setStageFilter} label="Stage">
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-muted">
              <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                Name
              </Th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <Th
                onClick={() => toggleSort("value_gbp")}
                active={sortKey === "value_gbp"}
                dir={sortDir}
              >
                Value
              </Th>
              <Th
                onClick={() => toggleSort("created_at")}
                active={sortKey === "created_at"}
                dir={sortDir}
              >
                Added
              </Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-border last:border-0 hover:bg-surface-2"
              >
                <td className="px-4 py-3">
                  <Link href={`/contacts/${c.id}`} className="text-text hover:text-accent">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <TierBadge tier={c.tier} />
                </td>
                <td className="px-4 py-3 text-text-muted">{SOURCE_LABELS[c.source]}</td>
                <td className="px-4 py-3 text-text-muted">{STAGE_LABELS[c.stage]}</td>
                <td className="px-4 py-3 text-text">{formatGBP(c.value_gbp)}</td>
                <td className="px-4 py-3 text-text-faint">{formatDate(c.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-faint">
                  No contacts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text outline-none focus:border-border-strong"
    >
      {children}
    </select>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <button
        onClick={onClick}
        className={`flex items-center gap-1 transition hover:text-text ${
          active ? "text-text" : ""
        }`}
      >
        {children}
        {active && <span className="text-accent">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
