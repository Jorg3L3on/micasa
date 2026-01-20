'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/EmptyState'
import PageHeader from '@/components/PageHeader'
import ExpenseForm, { ExpenseFormValues } from '@/components/ExpenseForm'
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog'
import {
  clientFetchFromApi,
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/lib/api'
import { Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Expense = {
  id: number
  name: string
  category: string
  categoryId: number | null
  defaultAmount: number | null
  paymentMethod: string
  paymentMethodId: number
  active: boolean
}

type Category = {
  id: number
  name: string
}

type PaymentMethod = {
  id: number
  name: string
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [expensesData, categoriesData, paymentMethodsData] = await Promise.all([
        clientFetchFromApi<Expense[]>('/api/expenses'),
        clientFetchFromApi<Category[]>('/api/categories'),
        clientFetchFromApi<PaymentMethod[]>('/api/payment-methods'),
      ])
      setExpenses(expensesData)
      setCategories(categoriesData)
      setPaymentMethods(paymentMethodsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreate = async (data: ExpenseFormValues) => {
    try {
      setFormError(null)
      await createExpense(data)
      await fetchData()
      setCreateDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create expense'
      setFormError(message)
      throw err
    }
  }

  const handleEdit = async (data: ExpenseFormValues) => {
    if (!selectedExpense) return
    try {
      setFormError(null)
      await updateExpense(selectedExpense.id, data)
      await fetchData()
      setEditDialogOpen(false)
      setSelectedExpense(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update expense'
      setFormError(message)
      throw err
    }
  }

  const handleDelete = async () => {
    if (!selectedExpense) return
    try {
      setError(null)
      await deleteExpense(selectedExpense.id)
      await fetchData()
      setDeleteDialogOpen(false)
      setSelectedExpense(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete expense'
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict')
      ) {
        setError('Expense is in use and cannot be deleted')
      } else {
        setError(message)
      }
    }
  }

  const openEditDialog = (expense: Expense) => {
    setSelectedExpense(expense)
    setEditDialogOpen(true)
    setFormError(null)
  }

  const openDeleteDialog = (expense: Expense) => {
    setSelectedExpense(expense)
    setDeleteDialogOpen(true)
    setError(null)
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Gastos" />
        <Button onClick={() => setCreateDialogOpen(true)}>Agregar gasto</Button>
      </div>

      {error && !deleteDialogOpen && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando...</div>
          ) : expenses.length === 0 ? (
            <EmptyState message="No se encontraron gastos" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Monto por defecto</TableHead>
                  <TableHead>Método de pago</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.name}</TableCell>
                    <TableCell className="text-muted-foreground">{expense.category}</TableCell>
                    <TableCell className="text-right">
                      {expense.defaultAmount ? formatCurrency(expense.defaultAmount) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.paymentMethod}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          expense.active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}
                      >
                        {expense.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(expense)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(expense)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExpenseForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          setFormError(null)
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createDialogOpen ? formError : null}
        categories={categories}
        paymentMethods={paymentMethods}
      />

      {selectedExpense && (
        <>
          <ExpenseForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open)
              setSelectedExpense(null)
              setFormError(null)
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedExpense.name,
              categoryId: selectedExpense.categoryId || 0,
              defaultAmount: selectedExpense.defaultAmount,
              paymentMethodId: selectedExpense.paymentMethodId,
              active: selectedExpense.active,
            }}
            error={formError && editDialogOpen ? formError : null}
            categories={categories}
            paymentMethods={paymentMethods}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open)
              if (!open) {
                setSelectedExpense(null)
                setError(null)
              }
            }}
            onConfirm={handleDelete}
            title="Eliminar gasto"
            description="¿Estás seguro de querer eliminar este gasto? Esta acción no puede ser deshecha."
            itemName={selectedExpense.name}
          />
        </>
      )}
    </>
  )
}
