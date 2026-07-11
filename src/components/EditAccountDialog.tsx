'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import {
  updateAccountSchema,
  UpdateAccountValues,
} from '@/schemas/account.schema';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

type EditAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSuccess?: (data: { name?: string }) => void;
};

export default function EditAccountDialog({
  open,
  onOpenChange,
  defaultName,
  onSuccess,
}: EditAccountDialogProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<UpdateAccountValues>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      name: defaultName,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset transient dialog error when opening.
      setApiError(null);
      form.reset({
        name: defaultName,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [open, defaultName, form]);

  const handleSubmit = async (data: UpdateAccountValues) => {
    setApiError(null);
    const body: {
      name?: string;
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};
    if (data.name != null && data.name.trim()) {
      body.name = data.name.trim();
    }
    const hasNewPassword =
      data.newPassword != null && String(data.newPassword).trim().length > 0;
    if (hasNewPassword) {
      body.currentPassword = String(data.currentPassword ?? '').trim();
      body.newPassword = String(data.newPassword).trim();
      body.confirmPassword = String(data.confirmPassword ?? '').trim();
    }

    try {
      const res = await clientFetchFromApi<{ name?: string }>('/api/account', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      form.reset({
        name: res.name ?? data.name,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      onOpenChange(false);
      onSuccess?.(res);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Error al actualizar la cuenta'
      );
    }
  };

  const newPasswordValue = form.watch('newPassword');
  const isChangingPassword =
    newPasswordValue != null && String(newPasswordValue).trim().length > 0;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setApiError(null);
      form.reset({
        name: defaultName,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cuenta</DialogTitle>
          <DialogDescription>
            Actualiza tu nombre y/o contraseña. Deja la contraseña en blanco si
            no deseas cambiarla.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {apiError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {apiError}
              </div>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isChangingPassword ? (
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña actual</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="Tu contraseña actual"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Dejar en blanco para no cambiar"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar nueva contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Repite la nueva contraseña"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
