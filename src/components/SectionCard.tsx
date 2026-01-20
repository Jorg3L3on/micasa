import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

type SectionCardProps = {
  title: string
  amount: number
  variant?: 'default' | 'warning' | 'success'
  description?: string
}

export default function SectionCard({
  title,
  amount,
  variant = 'default',
  description,
}: SectionCardProps) {
  const variantStyles = {
    default: 'bg-card',
    warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
  }

  const textStyles = {
    default: 'text-foreground',
    warning: 'text-yellow-900 dark:text-yellow-100',
    success: 'text-green-900 dark:text-green-100',
  }

  return (
    <Card className={cn(variantStyles[variant])}>
      <CardHeader>
        <CardTitle className={cn('text-sm font-medium', textStyles[variant])}>
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-bold', textStyles[variant])}>
          {formatCurrency(amount)}
        </p>
      </CardContent>
    </Card>
  )
}
