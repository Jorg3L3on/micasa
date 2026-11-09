import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import type { ApplyPlanResult } from '@/lib/finance/cash-plan/apply-plan-mapping';
import type { CashPlanApplyInput } from '@/schemas/cash-plan-apply.schema';

/** "Activar este plan": the server recomputes the route and writes its steps. */
export const applyCashPlanRoute = (body: CashPlanApplyInput, context?: FinanceContextType) =>
  clientFetchFromApi<ApplyPlanResult>(
    '/api/wallets/liquidity/plan/apply',
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
