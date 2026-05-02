import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { subcategoryService } from '../services/subcategoryService'

const SubcategoryStoreContext = createContext(null)

export function SubcategoryStoreProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const fetchedRef = useRef(false)

  const fetchSubcategories = useCallback(async (force = false) => {
    if (!force && fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    setError(null)
    try {
      const payload = await subcategoryService.getAll()
      setData(payload.subcategories || [])
    } catch (err) {
      setError(err.message || 'Could not load subcategories')
      fetchedRef.current = false
    } finally {
      setLoading(false)
    }
  }, [])

  const invalidate = useCallback(() => {
    fetchedRef.current = false
    setData(null)
    setError(null)
    setRefreshVersion(v => v + 1)
  }, [])

  const createSubcategory = useCallback(async (data) => {
    const result = await subcategoryService.create(data)
    invalidate()
    return result
  }, [invalidate])

  const updateSubcategory = useCallback(async (id, data) => {
    const result = await subcategoryService.update(id, data)
    invalidate()
    return result
  }, [invalidate])

  const value = useMemo(
    () => ({
      data, loading, error, refreshVersion,
      fetchSubcategories, createSubcategory, updateSubcategory, invalidate,
    }),
    [
      data, loading, error, refreshVersion,
      fetchSubcategories, createSubcategory, updateSubcategory, invalidate,
    ]
  )

  return (
    <SubcategoryStoreContext.Provider value={value}>
      {children}
    </SubcategoryStoreContext.Provider>
  )
}

export function useSubcategoryStore() {
  const {
    data, loading, error, refreshVersion,
    fetchSubcategories, createSubcategory, updateSubcategory, invalidate,
  } = useContext(SubcategoryStoreContext)

  useEffect(() => { fetchSubcategories() }, [fetchSubcategories, refreshVersion])

  return {
    subcategories: data,
    loading,
    error,
    createSubcategory,
    updateSubcategory,
    invalidate,
    refresh: () => fetchSubcategories(true),
  }
}

export function useSubcategoryActions() {
  const { invalidate } = useContext(SubcategoryStoreContext)
  return { invalidateSubcategories: invalidate }
}
