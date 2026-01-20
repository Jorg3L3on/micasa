'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

const fortnightSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  startDay: z.number().int().min(1).max(31),
  endDay: z.number().int().min(1).max(31),
  active: z.boolean().default(true),
})

export type FortnightFormValues = z.infer<typeof fortnightSchema>

type FortnightFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: FortnightFormValues) => Promise<void>
  defaultValues?: FortnightFormValues
  mode: 'create' | 'edit'
  error?: string | null
}

export default function FortnightForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
}: FortnightFormProps) {
  const form = useForm<FortnightFormValues>({
    resolver: zodResolver(fortnightSchema),
    defaultValues: defaultValues || {
      name: '',
      startDay: 1,
      endDay: 15,
      active: true,
    },
  })

  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues)
    } else if (open && !defaultValues) {
      form.reset({
        name: '',
        startDay: 1,
        endDay: 15,
        active: true,
      })
    }
  }, [open, defaultValues, form])

  const handleSubmit = async (data: FortnightFormValues) => {
    try {
      await onSubmit(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the parent component
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Fortnight' : 'Edit Fortnight'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new fortnight period for budgeting.'
              : 'Update the fortnight information.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., First Fortnight" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{mode === 'create' ? 'Create' : 'Update'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
