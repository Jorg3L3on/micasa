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

type PersonTotal = {
  person: string
  total: number
}

type BalanceTableProps = {
  title: string
  balances: PersonTotal[]
}

export default function BalanceTable({ title, balances }: BalanceTableProps) {
  const total = balances.reduce((sum, balance) => sum + balance.total, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titular</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {balances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Sin datos
                </TableCell>
              </TableRow>
            ) : (
              <>
                {balances.map((balance) => (
                  <TableRow key={balance.person}>
                    <TableCell className="font-medium">{balance.person}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(balance.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
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
