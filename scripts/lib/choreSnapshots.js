// scripts/lib/choreSnapshots.js
// Pure helpers for the chore-month snapshots written by syncSheet.js.
// Kept in their own module so they can be unit-tested — importing syncSheet.js
// directly would kick off a real sync.

/**
 * Collapse duplicate chore snapshots so the batch has exactly one row per
 * (member_id, month).
 *
 * Why this exists: the members upsert keys on phone, so two roster rows that
 * share a phone number resolve to the SAME member id and each push a snapshot
 * for the same month. Postgres refuses an upsert whose batch touches one
 * conflict target twice — "ON CONFLICT DO UPDATE command cannot affect row a
 * second time" — and rejects the ENTIRE batch, not just the offending pair.
 * That means one duplicated phone in the staff sheet silently wipes out chore
 * history for every member that month.
 *
 * Duplicates merge to the HIGHEST count: chore badges are durable and must
 * never un-earn, so the merge can only ever round up.
 *
 * @param {Array<{member_id: string, month: string, chores_done: number}>} snapshots
 * @returns {{rows: Array, merged: number}} deduped rows, and how many entries were folded in
 */
export function dedupeChoreSnapshots(snapshots = []) {
  const byMember = new Map()
  let merged = 0

  for (const s of snapshots) {
    if (!s || !s.member_id) continue
    const count = Math.max(0, parseInt(s.chores_done, 10) || 0)
    const key = `${s.member_id}|${s.month}`
    const prior = byMember.get(key)

    if (prior) {
      merged++
      prior.chores_done = Math.max(prior.chores_done, count)
    } else {
      byMember.set(key, { ...s, chores_done: count })
    }
  }

  return { rows: [...byMember.values()], merged }
}
