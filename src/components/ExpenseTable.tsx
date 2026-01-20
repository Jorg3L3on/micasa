import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency, formatDate } from '@/lib/utils'

type Expense = {
  id: number
  date: string
  description: string
  amount: number | string
  category: string
  paymentMethod: string
  is_paid: boolean
  user: string
}

type ExpenseTableProps = {
  date: string
  expenses: Expense[]
}

export default function ExpenseTable({ date, expenses }: ExpenseTableProps) {
  const total = expenses.reduce((sum, expense) => {
    return sum + Number(expense.amount)
  }, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium">
          {formatDate(date)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Pagado</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin gastos
                </TableCell>
              </TableRow>
            ) : (
              <>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <Checkbox checked={expense.is_paid} disabled />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{expense.user}</TableCell>
                    <TableCell className="text-sm">{expense.description}</TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(Number(expense.amount))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={3} className="text-right text-sm">
                    Total:
                  </TableCell>
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
