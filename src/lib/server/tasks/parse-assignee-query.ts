/**
 * Optional filter for task APIs: only rows assigned to this house member.
 */
export function parseAssigneeUserIdFilter(
  searchParams: URLSearchParams,
): number | undefined {
  const raw = searchParams.get('assigneeUserId');
  if (raw == null || raw === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
