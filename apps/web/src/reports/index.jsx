import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useReportStore } from '../stores/reportStore'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function currentDate() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function compactFmt(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export default function ReportsPage({ onAddExpense }) {
  const [mode] = useState('monthly')
  const [selectedMonth] = useState(currentMonth())
  const [selectedDate] = useState(currentDate())

  const { monthlySummary, dailySummary, breakdown, loading, error } = useReportStore(
    selectedMonth,
    selectedDate,
    mode
  )

  const expenseCards = breakdown?.breakdown || []

  return (
    <div className="reports-page reports-dashboard-page">
      {loading && <p className="form-loading">Loading reports…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && monthlySummary && dailySummary && (
        <>
          <section className="report-hero-card">
            <p className="reports-hero-kicker">Overview</p>

            <div className="report-hero-value-wrap">
              <span className="report-hero-label">This month</span>
              <div className="report-hero-value">₱{compactFmt(monthlySummary.expense_total)}</div>
            </div>

            <div className="report-hero-footer">
              <div className="report-hero-daily">
                <span className="report-hero-daily-label">Today</span>
                <strong>₱{fmt(dailySummary.expense_total)}</strong>
              </div>
              <button type="button" className="report-add-expense-btn" onClick={onAddExpense}>
                <span>Add expense</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </section>

          <section className="report-panel report-panel--category-cards">
            <div className="report-panel-head report-panel-head--stacked-mobile">
              <div>
                <h3 className="section-title section-title--report-panel">Expense Breakdown</h3>
                <p className="report-panel-period">
                  {new Date(selectedMonth + '-02').toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {expenseCards.length === 0 ? (
              <p className="txn-empty">No expense categories for this period.</p>
            ) : (
              <div className="report-category-card-grid">
                {expenseCards.map((item, index) => {
                  const label = item.category_name || item.subcategory_name || 'Uncategorized'
                  return (
                    <article
                      key={`${item.category_id || 'uncat'}-${item.subcategory_id || index}`}
                      className="report-category-card"
                    >
                      <div className="report-category-card-value">₱{compactFmt(item.total_amount)}</div>
                      <div className="report-category-card-label">{label}</div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
