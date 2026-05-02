import { useMemo, useState } from 'react'
import { useBootstrapStore } from '../../stores/bootstrapStore'
import { useSubcategoryStore } from '../../stores/subcategoryStore'

function blankForm() {
  return {
    category_id: '',
    name: '',
    is_active: true,
    sort_order: '0',
  }
}

export default function SubcategoriesManager({ onChanged }) {
  const { data: bootstrap } = useBootstrapStore()
  const {
    subcategories, loading, error, refresh,
    createSubcategory, updateSubcategory,
  } = useSubcategoryStore()
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(blankForm())
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterCategoryId, setFilterCategoryId] = useState('')

  const categoriesById = useMemo(() => {
    const map = new Map()
    ;(bootstrap?.categories || []).forEach((category) => map.set(category.id, category))
    return map
  }, [bootstrap])

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setForm(blankForm())
    setEditingId(null)
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({
      category_id: String(item.category_id),
      name: item.name,
      is_active: Boolean(item.is_active),
      sort_order: String(item.sort_order ?? 0),
    })
    setFormError('')
    setMessage('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    setMessage('')

    try {
      const payload = {
        category_id: Number(form.category_id),
        name: form.name.trim(),
        is_active: form.is_active,
        sort_order: Number(form.sort_order || 0),
      }

      const data = editingId
        ? await updateSubcategory(editingId, payload)
        : await createSubcategory(payload)

      setMessage(editingId ? `Updated ${data.name}` : `Created ${data.name}`)
      resetForm()
      if (onChanged) onChanged()
      else refresh()
    } catch (err) {
      setFormError(err.message || 'Could not reach the server')
    } finally {
      setSaving(false)
    }
  }

  const filteredSubcategories = filterCategoryId
    ? (subcategories || []).filter((item) => item.category_id === Number(filterCategoryId))
    : (subcategories || [])
  const displayError = error || formError

  if (!bootstrap) return <p className="form-loading">Loading categories…</p>

  return (
    <div className="settings-manager">
      <form className="txn-form settings-form" onSubmit={handleSubmit}>
        <div className="settings-form-header">
          <div>
            <div className="settings-section-title">{editingId ? 'Edit Subcategory' : 'New Subcategory'}</div>
            <div className="budget-meta">Create and maintain subcategories under each expense category.</div>
          </div>
        </div>

        <div className="form-group">
          <label>Category</label>
          <select
            value={form.category_id}
            onChange={(e) => updateForm('category_id', e.target.value)}
            required
            disabled={saving}
          >
            <option value="">— select category —</option>
            {bootstrap.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Subcategory Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            placeholder="e.g. Grocery"
            required
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label>Sort Order</label>
          <input
            type="number"
            step="1"
            value={form.sort_order}
            onChange={(e) => updateForm('sort_order', e.target.value)}
            required
            disabled={saving}
          />
        </div>

        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => updateForm('is_active', e.target.checked)}
            disabled={saving}
          />
          <span>Subcategory is active</span>
        </label>

        {displayError && <p className="form-error">{displayError}</p>}
        {message && <p className="form-success">{message}</p>}

        <div className="modal-actions settings-actions">
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
              Cancel Edit
            </button>
          )}
          <button type="submit" className="btn-submit" disabled={saving || !form.category_id}>
            {saving ? 'Saving…' : editingId ? 'Update Subcategory' : 'Create Subcategory'}
          </button>
        </div>
      </form>

      <div className="settings-list-wrap">
        <div className="settings-toolbar">
          <div className="settings-section-title">Subcategories</div>
          <select
            className="type-filter"
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {bootstrap.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        {loading && <p className="form-loading">Loading subcategories…</p>}
        {!loading && filteredSubcategories.length === 0 && <p className="txn-empty">No subcategories found.</p>}

        {!loading && filteredSubcategories.length > 0 && (
          <div className="settings-list">
            {filteredSubcategories.map((item) => (
              <div key={item.id} className="settings-item">
                <div className="settings-item-main">
                  <div className="settings-item-title-row">
                    <div className="settings-item-title">{item.name}</div>
                    {!item.is_active && <span className="txn-type-badge">inactive</span>}
                  </div>
                  <div className="settings-item-meta">
                    Category: {categoriesById.get(item.category_id)?.name || 'Unknown'}
                  </div>
                  <div className="settings-item-meta">Sort order: {item.sort_order}</div>
                </div>
                <div className="txn-actions settings-item-actions">
                  <button type="button" className="txn-btn-edit" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
