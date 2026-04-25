function optionName(items = [], id, fallback = '—') {
  const match = items.find(item => Number(item.id) === Number(id))
  return match?.name || fallback
}

export function toOfflineTransactionView(txn, bootstrap) {
  if (txn.type === 'expense') {
    return {
      ...txn,
      category_name: optionName(bootstrap?.categories, txn.category_id),
      subcategory_name: optionName(bootstrap?.subcategories, txn.subcategory_id),
      account_name: optionName(bootstrap?.accounts, txn.account_id),
      place_name: txn.place_id ? optionName(bootstrap?.places, txn.place_id) : null,
    }
  }

  if (txn.type === 'income') {
    return {
      ...txn,
      account_name: optionName(bootstrap?.accounts, txn.account_id),
      income_source_name: optionName(bootstrap?.income_sources, txn.income_source_id),
    }
  }

  if (txn.type === 'transfer') {
    return {
      ...txn,
      from_account_name: optionName(bootstrap?.accounts, txn.from_account_id),
      to_account_name: optionName(bootstrap?.accounts, txn.to_account_id),
    }
  }

  return txn
}
