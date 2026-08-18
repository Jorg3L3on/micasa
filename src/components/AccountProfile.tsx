'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  type UpdateAccountValues,
} from '@/schemas/account.schema';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

type AccountProfileProps = {
  initialName: string;
  email: string;
  image: string;
};

export default function AccountProfile({
  initialName,
  email,
  image,
}: AccountProfileProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [apiError, setApiError] = useState<string | null>(null);
  const { data: session, update } = useSession();

  const form = useForm<UpdateAccountValues>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      name: initialName,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPasswordValue = form.watch('newPassword');
  const isChangingPassword =
    newPasswordValue != null && String(newPasswordValue).trim().length > 0;

  const resetForm = (name = displayName) => {
    setApiError(null);
    form.reset({
      name,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

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

      const nextName = res.name ?? data.name ?? displayName;
      setDisplayName(nextName);
      resetForm(nextName);
      update?.({ ...session, user: { ...session?.user, name: nextName } });
      toast.success('Cuenta actualizada');
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Error al actualizar la cuenta',
      );
    }
  };

  return (
    <div className="w-full space-y-5">
      <div
        className="sticky top-16 z-40 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 bg-background px-4 py-2 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
        aria-label="Información de la cuenta"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            Información de la cuenta
          </h2>
          <p className="text-xs text-muted-foreground">
            Actualiza tu nombre y/o contraseña. Deja la contraseña en blanco si
            no deseas cambiarla.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/60">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-lg">
              <AvatarImage src={image} alt={displayName} />
              <AvatarFallback className="rounded-lg text-lg">
                {displayName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Correo electrónico
              </p>
              <p className="truncate text-sm">{email || '—'}</p>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              {apiError ? (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {apiError}
                </div>
              ) : null}

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

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetForm()}
                  disabled={form.formState.isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  aria-busy={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
