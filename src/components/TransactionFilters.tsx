'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import React from 'react'

export default function TransactionFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(searchParams.get('month') || '')
  const [year, setYear] = useState(searchParams.get('year') || '')
  const [type, setType] = useState(searchParams.get('type') || '')

  const currentYear = new Date().getFullYear()

  const handleChange = (field: 'month' | 'year' | 'type', value: string) => {
    const newParams = new URLSearchParams(searchParams.toString())
    
    if (field === 'month') {
      setMonth(value)
      if (value) newParams.set('month', value)
      else newParams.delete('month')
    } else if (field === 'year') {
      setYear(value)
      if (value) newParams.set('year', value)
      else newParams.delete('year')
    } else if (field === 'type') {
      setType(value)
      if (value) newParams.set('type', value)
      else newParams.delete('type')
    }

    router.push(`/transactions${newParams.toString() ? `?${newParams.toString()}` : ''}`)
  }

  return (
    <div className="mb-6 flex gap-4 flex-wrap items-end">
      <div className="flex flex-col gap-2">
        <label htmlFor="month" className="text-sm font-medium">
          Mes
        </label>
        <select
          id="month"
          value={month}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('month', e.target.value)}
          className="w-[180px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString('es-MX', { month: 'long' })}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="year" className="text-sm font-medium">
          Año
        </label>
        <select
          id="year"
          value={year}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('year', e.target.value)}
          className="w-[180px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="type" className="text-sm font-medium">
          Tipo
        </label>
        <select
          id="type"
          value={type}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('type', e.target.value)}
          className="w-[180px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>
      </div>
    </div>
  )
}
