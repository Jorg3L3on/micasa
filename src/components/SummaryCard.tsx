type SummaryCardProps = {
  title: string
  amount: number
  variant?: 'income' | 'expense' | 'balance'
}

export default function SummaryCard({ title, amount, variant = 'balance' }: SummaryCardProps) {
  const getColorClass = () => {
    if (variant === 'income') return 'text-green-600'
    if (variant === 'expense') return 'text-red-600'
    return amount >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500 mb-2">{title}</h2>
      <p className={`text-3xl font-bold ${getColorClass()}`}>{formatCurrency(amount)}</p>
    </div>
  )
}
