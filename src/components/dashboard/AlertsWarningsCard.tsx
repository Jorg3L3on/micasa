import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS } from './constants';

type AlertsWarningsCardProps = {
  data: DashboardData;
};

const severityConfig = {
  error: {
    variant: 'destructive' as const,
    icon: AlertTriangle,
    label: 'Error',
  },
  warning: {
    variant: 'warning' as const,
    icon: AlertCircle,
    label: 'Aviso',
  },
  info: {
    variant: 'default' as const,
    icon: Info,
    label: 'Info',
  },
};

export default function AlertsWarningsCard({ data }: AlertsWarningsCardProps) {
  const alerts = data.alerts;

  const hasAlerts = alerts.length > 0;

  return (
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader
        className={
          hasAlerts
            ? 'flex flex-row items-center justify-between space-y-0 pb-2'
            : undefined
        }
      >
        <CardTitle className="text-base font-medium">
          Alertas y avisos
        </CardTitle>
        {hasAlerts && (
          <Badge variant="secondary" aria-label={`${alerts.length} alertas`}>
            {alerts.length}
          </Badge>
        )}
      </CardHeader>
      <CardContent className={hasAlerts ? 'space-y-3' : undefined}>
        {!hasAlerts ? (
          <p className="text-sm text-muted-foreground">
            No hay alertas en este periodo.
          </p>
        ) : (
          alerts.map((alert) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;
            return (
              <Alert key={alert.type} variant={config.variant}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <div className="flex flex-col gap-1">
                  <AlertTitle>{alert.title}</AlertTitle>
                  <AlertDescription>{alert.description}</AlertDescription>
                </div>
              </Alert>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
