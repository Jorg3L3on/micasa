'use client';

import { CalendarPlus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import CreateMonthForm from '@/components/CreateMonthForm';

const currentYear = new Date().getFullYear();

export default function CreateMonthCard() {
  return (
    <Card className="card-glass rounded-lg border-border/50 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarPlus className="h-5 w-5 text-primary" aria-hidden />
          Crear mes (dos quincenas)
        </CardTitle>
        <CardDescription>
          Crea la primera y segunda quincena para el mes actual o futuros del
          año {currentYear}. Solo se listan meses que aún no tienen quincenas
          creadas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateMonthForm idPrefix="create-month-card" />
      </CardContent>
    </Card>
  );
}
