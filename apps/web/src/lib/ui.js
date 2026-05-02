export const ACCOUNT_TYPE_STYLES = {
  checking: {
    label: 'Checking',
    className: 'account-type-pill--checking',
    color: '#3b82f6',
    description: 'Blue for everyday banking and primary cash flow',
  },
  savings: {
    label: 'Savings',
    className: 'account-type-pill--savings',
    color: '#10b981',
    description: 'Green for stored money and growth',
  },
  cash: {
    label: 'Cash',
    className: 'account-type-pill--cash',
    color: '#f59e0b',
    description: 'Amber for physical money and quick visibility',
  },
  credit: {
    label: 'Credit',
    className: 'account-type-pill--credit',
    color: '#ef4444',
    description: 'Red for debt / liability accounts',
  },
}

export function getAccountTypeMeta(type) {
  return ACCOUNT_TYPE_STYLES[type] || {
    label: type || 'Unknown',
    className: '',
    color: '#6b7280',
    description: 'Fallback account type color',
  }
}
