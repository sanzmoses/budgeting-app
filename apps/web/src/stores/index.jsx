import { BootstrapStoreProvider, useBootstrapActions } from './bootstrapStore'
import { BudgetStoreProvider, useBudgetActions } from './budgetStore'
import { TransactionStoreProvider, useTransactionActions } from './transactionStore'
import { AccountStoreProvider, useAccountActions } from './accountStore'
import { ReportStoreProvider, useReportActions } from './reportStore'
import { SubcategoryStoreProvider, useSubcategoryActions } from './subcategoryStore'

export function StoreProvider({ children }) {
  return (
    <BootstrapStoreProvider>
      <BudgetStoreProvider>
        <TransactionStoreProvider>
          <AccountStoreProvider>
            <ReportStoreProvider>
              <SubcategoryStoreProvider>
                {children}
              </SubcategoryStoreProvider>
            </ReportStoreProvider>
          </AccountStoreProvider>
        </TransactionStoreProvider>
      </BudgetStoreProvider>
    </BootstrapStoreProvider>
  )
}

export function useStoreActions() {
  const { invalidateBootstrap } = useBootstrapActions()
  const { invalidateBudgets } = useBudgetActions()
  const { invalidateTransactions } = useTransactionActions()
  const { invalidateAccounts } = useAccountActions()
  const { invalidateReports } = useReportActions()
  const { invalidateSubcategories } = useSubcategoryActions()

  return {
    invalidateBootstrap,
    invalidateBudgets,
    invalidateTransactions,
    invalidateAccounts,
    invalidateReports,
    invalidateSubcategories,
  }
}
