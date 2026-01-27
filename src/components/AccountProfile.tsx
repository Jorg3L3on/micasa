'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import EditAccountDialog from '@/components/EditAccountDialog';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: session, update } = useSession();

  const handleSuccess = (data: { name?: string }) => {
    if (data.name != null) {
      setDisplayName(data.name);
      update?.({ ...session, user: { ...session?.user, name: data.name } });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Información de la cuenta</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <div className="space-y-1">
              <Label className="text-muted-foreground">Nombre</Label>
              <p className="text-lg font-medium">{displayName || '—'}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Correo electrónico</Label>
            <p className="text-sm">{email || '—'}</p>
          </div>
        </CardContent>
      </Card>

      <EditAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultName={displayName}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
