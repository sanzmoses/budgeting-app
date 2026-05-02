import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { accountService } from '../services/accountService'

const AccountStoreContext = createContext(null)

export function AccountStoreProvider({ children }) {
  const [accounts, setAccounts] = useState(null)
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState(null)
  const accountsFetchedRef = useRef(false)
  const [accountsRefreshVersion, setAccountsRefreshVersion] = useState(0)

  const [balances, setBalances] = useState(null)
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [balancesError, setBalancesError] = useState(null)
  const balancesFetchedRef = useRef(false)
  const [balancesRefreshVersion, setBalancesRefreshVersion] = useState(0)

  const fetchAccounts = useCallback(async (force = false) => {
    if (!force && accountsFetchedRef.current) return
    accountsFetchedRef.current = true
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const data = await accountService.getAll()
      setAccounts(data.accounts || [])
    } catch (err) {
      setAccountsError(err.message || 'Could not load accounts')
      accountsFetchedRef.current = false
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const fetchBalances = useCallback(async (force = false) => {
    if (!force && balancesFetchedRef.current) return
    balancesFetchedRef.current = true
    setBalancesLoading(true)
    setBalancesError(null)
    try {
      const data = await accountService.getBalances()
      setBalances(data)
    } catch (err) {
      setBalancesError(err.message || 'Could not load balances')
      balancesFetchedRef.current = false
    } finally {
      setBalancesLoading(false)
    }
  }, [])

  const invalidate = useCallback(() => {
    accountsFetchedRef.current = false
    balancesFetchedRef.current = false
    setAccounts(null)
    setBalances(null)
    setAccountsError(null)
    setBalancesError(null)
    setAccountsRefreshVersion(v => v + 1)
    setBalancesRefreshVersion(v => v + 1)
  }, [])

  const createAccount = useCallback(async (data) => {
    const result = await accountService.create(data)
    invalidate()
    return result
  }, [invalidate])

  const updateAccount = useCallback(async (id, data) => {
    const result = await accountService.update(id, data)
    invalidate()
    return result
  }, [invalidate])

  const deleteAccount = useCallback(async (id, confirmation) => {
    const result = await accountService.delete(id, confirmation)
    invalidate()
    return result
  }, [invalidate])

  const value = useMemo(() => ({
    accounts, accountsLoading, accountsError,
    balances, balancesLoading, balancesError,
    accountsRefreshVersion, balancesRefreshVersion,
    fetchAccounts, fetchBalances, createAccount, updateAccount, deleteAccount, invalidate,
  }), [
    accounts, accountsLoading, accountsError,
    balances, balancesLoading, balancesError,
    accountsRefreshVersion, balancesRefreshVersion,
    fetchAccounts, fetchBalances, createAccount, updateAccount, deleteAccount, invalidate,
  ])

  return (
    <AccountStoreContext.Provider value={value}>
      {children}
    </AccountStoreContext.Provider>
  )
}

export function useAccountStore() {
  const {
    accounts, accountsLoading, accountsError,
    accountsRefreshVersion, fetchAccounts,
    createAccount, updateAccount, deleteAccount, invalidate,
  } = useContext(AccountStoreContext)

  useEffect(() => { fetchAccounts() }, [fetchAccounts, accountsRefreshVersion])

  return {
    accounts,
    loading: accountsLoading,
    error: accountsError,
    createAccount,
    updateAccount,
    deleteAccount,
    invalidate,
    refresh: () => fetchAccounts(true),
  }
}

export function useBalancesStore() {
  const {
    balances, balancesLoading, balancesError,
    balancesRefreshVersion, fetchBalances, invalidate,
  } = useContext(AccountStoreContext)

  useEffect(() => { fetchBalances() }, [fetchBalances, balancesRefreshVersion])

  return {
    data: balances,
    loading: balancesLoading,
    error: balancesError,
    invalidate,
    refresh: () => fetchBalances(true),
  }
}

export function useAccountActions() {
  const { invalidate } = useContext(AccountStoreContext)
  return { invalidateAccounts: invalidate }
}
