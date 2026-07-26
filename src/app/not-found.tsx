import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <p className="text-2xl font-semibold tracking-tight">404</p>
          <p className="text-muted-foreground">
            No encontramos esta página. Puede que el enlace esté roto o que la
            ruta ya no exista.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
