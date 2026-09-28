export type LoanContextLists = {
  loans: [];
  lenders: [];
  wallets: [];
  incomeTemplates: [];
};

/** Lists the loans page drops together when the owner context changes. */
export const emptyLoanContextLists = (): LoanContextLists => ({
  loans: [],
  lenders: [],
  wallets: [],
  incomeTemplates: [],
});

/** A response belongs to the request that is still the active context. */
export const isCurrentLoanContext = (
  activeKey: string,
  requestKey: string,
): boolean => activeKey === requestKey;
