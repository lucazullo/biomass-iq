"use client";

import { useState } from "react";
import type { Summary } from "@/lib/types";
import { SUBSTANCE_COLORS } from "./ComparisonStats";

export interface SubstanceGroup {
  id: string;
  name: string;
  substance_ids: string[];
}

interface GroupEditorProps {
  summaries: Summary[];
  groups: SubstanceGroup[];
  onGroupsChange: (groups: SubstanceGroup[]) => void;
}

function nextGroupLetter(existing: SubstanceGroup[]): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const used = new Set(existing.map((g) => g.name.replace("Group ", "")));
  for (const l of letters) {
    if (!used.has(l)) return `Group ${l}`;
  }
  return `Group ${existing.length + 1}`;
}

export function GroupEditor({ summaries, groups, onGroupsChange }: GroupEditorProps) {
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  /**
   * Whenever a group ends up with exactly one substance, reset its name to
   * that substance's original name — so if the user merged and renamed the
   * group, then later split it apart, the remaining single-substance group
   * doesn't keep the stale merged-group label.
   */
  const normalizeNames = (gs: SubstanceGroup[]): SubstanceGroup[] =>
    gs.map((g) => {
      if (g.substance_ids.length !== 1) return g;
      const sub = summaries.find((s) => s.substance_id === g.substance_ids[0]);
      if (!sub) return g;
      if (g.name === sub.substance_name) return g;
      return { ...g, name: sub.substance_name };
    });

  if (summaries.length < 2) return null;

  const substanceToGroup = new Map<string, string>();
  for (const g of groups) {
    for (const sid of g.substance_ids) substanceToGroup.set(sid, g.id);
  }

  const moveTo = (substanceId: string, targetGroupId: string) => {
    const next = groups
      .map((g) => ({
        ...g,
        substance_ids: g.substance_ids.filter((id) => id !== substanceId),
      }))
      .filter((g) => g.substance_ids.length > 0);

    const existing = next.find((g) => g.id === targetGroupId);
    if (existing) {
      existing.substance_ids.push(substanceId);
    } else {
      const newGroup = {
        id: targetGroupId,
        name: groups.find((g) => g.id === targetGroupId)?.name ?? nextGroupLetter(next),
        substance_ids: [substanceId],
      };
      next.push(newGroup);
    }
    onGroupsChange(normalizeNames(next));
  };

  const addNewGroup = () => {
    const id = `g-${Date.now()}`;
    onGroupsChange([...groups, { id, name: nextGroupLetter(groups), substance_ids: [] }]);
    // Immediately open the rename input so the user can give it a meaningful name.
    setEditingNameId(id);
  };

  const renameGroup = (groupId: string, name: string) => {
    onGroupsChange(groups.map((g) => (g.id === groupId ? { ...g, name } : g)));
  };

  const splitAll = () => {
    // One substance per group
    onGroupsChange(
      summaries.map((s, i) => ({
        id: `g-sub-${s.substance_id}`,
        name: s.substance_name,
        substance_ids: [s.substance_id],
      })),
    );
  };

  /** Explode one group: each of its substances becomes its own single-substance group. */
  const unmergeGroup = (groupId: string) => {
    const target = groups.find((g) => g.id === groupId);
    if (!target || target.substance_ids.length < 2) return;
    const replacements: SubstanceGroup[] = target.substance_ids.map((sid) => {
      const sub = summaries.find((s) => s.substance_id === sid);
      return {
        id: `g-sub-${sid}-${Date.now()}`,
        name: sub?.substance_name || sid,
        substance_ids: [sid],
      };
    });
    const next: SubstanceGroup[] = [];
    for (const g of groups) {
      if (g.id === groupId) {
        next.push(...replacements);
      } else {
        next.push(g);
      }
    }
    onGroupsChange(normalizeNames(next));
  };

  /** Move one substance out of its current group into its own fresh group. */
  const splitOne = (substanceId: string) => {
    const sub = summaries.find((s) => s.substance_id === substanceId);
    const cleaned = groups
      .map((g) => ({ ...g, substance_ids: g.substance_ids.filter((id) => id !== substanceId) }))
      .filter((g) => g.substance_ids.length > 0);
    cleaned.push({
      id: `g-sub-${substanceId}-${Date.now()}`,
      name: sub?.substance_name || substanceId,
      substance_ids: [substanceId],
    });
    onGroupsChange(normalizeNames(cleaned));
  };

  /** Merge every substance into one combined group. */
  const mergeAll = () => {
    if (summaries.length < 2) return;
    onGroupsChange([
      {
        id: "g-all",
        name: "All merged",
        substance_ids: summaries.map((s) => s.substance_id),
      },
    ]);
  };

  const mergeAllExceptOne = () => {
    // Keep the first substance alone, merge the rest
    if (summaries.length < 3) return;
    onGroupsChange([
      {
        id: "g-first",
        name: summaries[0].substance_name,
        substance_ids: [summaries[0].substance_id],
      },
      {
        id: "g-rest",
        name: "Rest (merged)",
        substance_ids: summaries.slice(1).map((s) => s.substance_id),
      },
    ]);
  };

  const isSplit = groups.length === summaries.length;

  return (
    <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" open>
      <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition flex items-center justify-between">
        <span>Comparison Groups</span>
        <span className="text-xs font-normal text-gray-500">
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </span>
      </summary>

      <div className="px-6 py-4 space-y-3">
        <p className="text-xs text-gray-500">
          Use the dropdown on each substance chip to move it between groups, and click a group name (with the pencil icon) to rename it. Substances within a group are pooled together before comparison.
        </p>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={splitAll}
            disabled={isSplit}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            One group per substance
          </button>
          <button
            onClick={mergeAll}
            disabled={groups.length === 1 && groups[0].substance_ids.length === summaries.length}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Merge all into one group
          </button>
          {summaries.length >= 3 && (
            <button
              onClick={mergeAllExceptOne}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              First vs. rest (merged)
            </button>
          )}
          <button
            onClick={addNewGroup}
            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
          >
            + New empty group
          </button>
        </div>

        {/* Groups */}
        <div className="space-y-2">
          {groups.map((group, gIdx) => {
            const color = SUBSTANCE_COLORS[gIdx % SUBSTANCE_COLORS.length];
            const members = group.substance_ids
              .map((id) => summaries.find((s) => s.substance_id === id))
              .filter(Boolean) as Summary[];
            const totalObs = members.reduce((sum, s) => sum + s.total_observations, 0);

            return (
              <div
                key={group.id}
                className="flex items-start gap-3 rounded-lg border p-3"
                style={{
                  borderColor: color.stroke,
                  backgroundColor: color.fill + "15",
                }}
              >
                <div className="shrink-0 flex flex-col items-center">
                  <span
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: color.stroke }}
                  >
                    {gIdx + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {editingNameId === group.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={group.name}
                      onChange={(e) => renameGroup(group.id, e.target.value)}
                      onBlur={() => setEditingNameId(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingNameId(null)}
                      placeholder="Group name"
                      className="text-sm font-semibold rounded border border-teal-400 px-2 py-0.5 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-300"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingNameId(group.id)}
                      className="group/name inline-flex items-center gap-1 text-sm font-semibold text-gray-800 hover:text-teal-700 text-left rounded px-1 -mx-1 hover:bg-white/60 transition"
                      title="Click to rename this group"
                    >
                      <span>{group.name}</span>
                      <svg
                        className="h-3 w-3 text-gray-400 group-hover/name:text-teal-600 transition"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                  )}
                  <span className="ml-2 text-[10px] text-gray-500">
                    {members.length} substance{members.length !== 1 ? "s" : ""} · {totalObs} observations
                  </span>
                  {members.length >= 2 && (
                    <button
                      onClick={() => unmergeGroup(group.id)}
                      className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 hover:text-red-600 transition"
                      title="Split each substance in this group back into its own separate group"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Unmerge
                    </button>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {members.map((s) => (
                      <span
                        key={s.substance_id}
                        className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700"
                      >
                        <span className="truncate max-w-[180px]">{s.substance_name}</span>
                        <select
                          value={group.id}
                          onChange={(e) => moveTo(s.substance_id, e.target.value)}
                          className="text-[10px] bg-transparent border-0 focus:ring-0 cursor-pointer text-gray-400 hover:text-gray-700"
                          title="Move to another group"
                        >
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>→ {g.name}</option>
                          ))}
                        </select>
                        {members.length >= 2 && (
                          <button
                            onClick={() => splitOne(s.substance_id)}
                            className="text-[11px] text-gray-400 hover:text-red-600 transition leading-none"
                            title={`Split ${s.substance_name} into its own group`}
                          >
                            ↗
                          </button>
                        )}
                      </span>
                    ))}
                    {members.length === 0 && (
                      <span className="text-xs text-gray-400 italic">Empty — drop a substance here from another group</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}
