'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import {
  adminSetTempPasswordSchema,
  type AdminSetTempPasswordValues,
} from '@/schemas/admin.schema';

type AdminSetTempPasswordDialogProps = {
  userId: number;
  userName: string;
  userEmail: string;
};

export const AdminSetTempPasswordDialog = ({
  userId,
  userName,
  userEmail,
}: AdminSetTempPasswordDialogProps) => {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<AdminSetTempPasswordValues | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<AdminSetTempPasswordValues>({
    resolver: zodResolver(adminSetTempPasswordSchema),
    defaultValues: {
      temporaryPassword: '',
      confirmPassword: '',
    },
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setApiError(null);
      setPending(null);
      form.reset();
    }
  };

  const handleSubmitForm = (values: AdminSetTempPasswordValues) => {
    setApiError(null);
    setPending(values);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setApiError(data.error ?? 'No se pudo actualizar la contraseña');
        setConfirmOpen(false);
        return;
      }
      toast.success(
        data.message ??
          'Contraseña temporal actualizada. Comunícasela al usuario por un canal seguro.',
      );
      setConfirmOpen(false);
      handleOpenChange(false);
    } catch {
      setApiError('Error de red. Inténtalo de nuevo.');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" className="h-9 gap-2 rounded-xl">
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            Contraseña temporal
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Establecer contraseña temporal</DialogTitle>
            <DialogDescription>
              Para {userName} ({userEmail}). Comunica la contraseña fuera de la
              app; no se envía por correo.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmitForm)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="temporaryPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña temporal</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        aria-label="Contraseña temporal"
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
                    <FormLabel>Confirmar contraseña</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        aria-label="Confirmar contraseña temporal"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {apiError ? (
                <p className="text-sm text-destructive" role="alert">
                  {apiError}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Continuar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de contraseña?</AlertDialogTitle>
            <AlertDialogDescription>
              Se reemplazará la contraseña de {userEmail}. Esta acción queda
              registrada en la bitácora de admin. Deberás comunicar la nueva
              contraseña de forma segura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {submitting ? 'Guardando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
