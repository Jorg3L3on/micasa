import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

type PaymentMethodTotal = {
  method: string
  total: number
}

type PaymentBreakdownTableProps = {
  methods: PaymentMethodTotal[]
}

export default function PaymentBreakdownTable({ methods }: PaymentBreakdownTableProps) {
  const total = methods.reduce((sum, method) => sum + method.total, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Total Pagado</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Sin datos
                </TableCell>
              </TableRow>
            ) : (
              <>
                {methods.map((method) => (
                  <TableRow key={method.method}>
                    <TableCell className="font-medium text-sm">{method.method}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(method.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(total)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
