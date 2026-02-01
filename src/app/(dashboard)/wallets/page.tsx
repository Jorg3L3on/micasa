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
import WalletForm from '@/components/WalletForm'
import { WalletFormValues } from '@/schemas/wallet.schema'
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog'
import { clientFetchFromApi, createWallet, updateWallet, deleteWallet } from '@/lib/api'
import { BadgeCheck, BookmarkIcon, Pencil, Trash2, WalletIcon } from 'lucide-react'
import { PaymentMethodType, PAYMENT_METHOD_LABELS } from "@/domain/payment-method";
import { Badge } from "@/components/ui/badge";

type Wallet = {
  id: number
  name: string
  amount: number
  type: PaymentMethodType
  status: boolean
  cutoff_day: number
  due_day: number
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchWallets = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await clientFetchFromApi<Wallet[]>('/api/wallets')
      setWallets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallets.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWallets()
  }, [])

  const handleCreate = async (data: WalletFormValues) => {
    try {
      setFormError(null)
      await createWallet({
        name: data.name,
        amount: data.amount || 0,
        type: data.type,
        status: true,
        cutoff_day: data.cutoff_day || null,
        due_day: data.due_day || null,
      })
      await fetchWallets()
      setCreateDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create wallet'
      setFormError(message)
      throw err
    }
  }

  const handleEdit = async (data: WalletFormValues) => {
    if (!selectedWallet) return
    try {
      setFormError(null)
      await updateWallet(selectedWallet.id, data)
      await fetchWallets()
      setEditDialogOpen(false)
      setSelectedWallet(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update wallet'
      setFormError(message)
      throw err
    }
  }

  const handleDelete = async () => {
    if (!selectedWallet) return
    try {
      setError(null)
      await deleteWallet(selectedWallet.id)
      await fetchWallets()
      setDeleteDialogOpen(false)
      setSelectedWallet(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete wallet'
      if (message.includes('409') || message.includes('in use') || message.includes('Conflict') || message.includes('related')) {
        setError('Wallet is in use and cannot be deleted')
      } else {
        setError(message)
      }
    }
  }

  const openEditDialog = (wallet: Wallet) => {
    setSelectedWallet(wallet)
    setEditDialogOpen(true)
    setFormError(null)
  }

  const openDeleteDialog = (wallet: Wallet) => {
    setSelectedWallet(wallet)
    setDeleteDialogOpen(true)
    setError(null)
  }

  const formatAmount = (amount: number): string => {
    return Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setCreateDialogOpen(true)}>
          <WalletIcon/>
          Agregar cartera
        </Button>
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
          ) : wallets.length === 0 ? (
            <EmptyState message="No se encontraron carteras"/>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet: Wallet) => (
                  <TableRow key={wallet.id} className={wallet.status ? '' : 'text-slate-900/50'}>
                    <TableCell className="font-medium">{wallet.name}</TableCell>
                    <TableCell>{formatAmount(wallet.amount)}</TableCell>
                    <TableCell>{PAYMENT_METHOD_LABELS[wallet.type]}</TableCell>
                    <TableCell>
                      {wallet.status ? (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            <BadgeCheck data-icon="inline-start" />
                            Active
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="outline">
                          <BookmarkIcon data-icon="inline-end" />
                          Archive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(wallet)}
                        >
                          <Pencil className="h-4 w-4"/>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(wallet)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive"/>
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

      <WalletForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          setFormError(null)
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createDialogOpen ? formError : null}
      />

      {selectedWallet && (
        <>
          <WalletForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open)
              setSelectedWallet(null)
              setFormError(null)
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={selectedWallet}
            error={formError && editDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open)
              if (!open) {
                setSelectedWallet(null)
                setError(null)
              }
            }}
            onConfirm={handleDelete}
            title="Eliminar cartera"
            description="¿Estás seguro de querer eliminar esta cartera? Esta acción no puede ser deshecha."
            itemName={selectedWallet.name}
          />
        </>
      )}
    </>
  )
}
