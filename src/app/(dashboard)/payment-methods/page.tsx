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
import PaymentMethodForm, { PaymentMethodFormValues } from '@/components/PaymentMethodForm'
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog'
import { clientFetchFromApi, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '@/lib/api'
import { Pencil, Trash2 } from 'lucide-react'

type PaymentMethod = {
  id: number
  name: string
  type: string
}

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await clientFetchFromApi<PaymentMethod[]>('/api/payment-methods')
      setPaymentMethods(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payment methods')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPaymentMethods()
  }, [])

  const handleCreate = async (data: PaymentMethodFormValues) => {
    try {
      setFormError(null)
      await createPaymentMethod(data)
      await fetchPaymentMethods()
      setCreateDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create payment method'
      setFormError(message)
      throw err
    }
  }

  const handleEdit = async (data: PaymentMethodFormValues) => {
    if (!selectedPaymentMethod) return
    try {
      setFormError(null)
      await updatePaymentMethod(selectedPaymentMethod.id, data)
      await fetchPaymentMethods()
      setEditDialogOpen(false)
      setSelectedPaymentMethod(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update payment method'
      setFormError(message)
      throw err
    }
  }

  const handleDelete = async () => {
    if (!selectedPaymentMethod) return
    try {
      setError(null)
      await deletePaymentMethod(selectedPaymentMethod.id)
      await fetchPaymentMethods()
      setDeleteDialogOpen(false)
      setSelectedPaymentMethod(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete payment method'
      if (message.includes('409') || message.includes('in use') || message.includes('Conflict') || message.includes('related')) {
        setError('Payment method is in use and cannot be deleted')
      } else {
        setError(message)
      }
    }
  }

  const openEditDialog = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod)
    setEditDialogOpen(true)
    setFormError(null)
  }

  const openDeleteDialog = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod)
    setDeleteDialogOpen(true)
    setError(null)
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Payment Methods" />
        <Button onClick={() => setCreateDialogOpen(true)}>Add Payment Method</Button>
      </div>

      {error && !deleteDialogOpen && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : paymentMethods.length === 0 ? (
            <EmptyState message="No payment methods found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentMethods.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(method)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(method)}
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

      <PaymentMethodForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          setFormError(null)
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createDialogOpen ? formError : null}
      />

      {selectedPaymentMethod && (
        <>
          <PaymentMethodForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open)
              setSelectedPaymentMethod(null)
              setFormError(null)
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedPaymentMethod.name,
            }}
            error={formError && editDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open)
              if (!open) {
                setSelectedPaymentMethod(null)
                setError(null)
              }
            }}
            onConfirm={handleDelete}
            title="Delete Payment Method"
            description="Are you sure you want to delete this payment method? This action cannot be undone."
            itemName={selectedPaymentMethod.name}
          />
        </>
      )}

    </>
  )
}
