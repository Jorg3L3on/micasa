import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

type UserIncome = {
  user: string
  amount: number
}

type SummaryBlockProps = {
  tenemos: number
  libre: number
  userIncome: UserIncome[]
}

export default function SummaryBlock({
  tenemos,
  libre,
  userIncome = [],
}: SummaryBlockProps) {
  const getLibreColorClasses = () => {
    if (libre > 1000) {
      return {
        card: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
        title: 'text-green-900 dark:text-green-100',
        amount: 'text-green-700 dark:text-green-300',
      }
    } else if (libre >= 0) {
      return {
        card: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900',
        title: 'text-yellow-900 dark:text-yellow-100',
        amount: 'text-yellow-700 dark:text-yellow-300',
      }
    } else {
      return {
        card: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900',
        title: 'text-red-900 dark:text-red-100',
        amount: 'text-red-700 dark:text-red-300',
      }
    }
  }

  const libreColors = getLibreColorClasses()

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-purple-900 dark:text-purple-100">
            Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {userIncome.length > 0 ? (
            <div className="space-y-2">
              <Table>
                <TableBody>
                  {userIncome.map((item) => (
                    <TableRow key={item.user} className="border-0">
                      <TableCell className="py-1 px-0 text-xs text-purple-900 dark:text-purple-100">
                        {item.user}
                      </TableCell>
                      <TableCell className="py-1 px-0 text-right text-xs font-medium text-purple-700 dark:text-purple-300">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t border-purple-300 dark:border-purple-800">
                    <TableCell className="py-1 px-0 text-xs font-semibold text-purple-900 dark:text-purple-100">
                      Total
                    </TableCell>
                    <TableCell className="py-1 px-0 text-right text-xs font-bold text-purple-700 dark:text-purple-300">
                      {formatCurrency(tenemos)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {formatCurrency(tenemos)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className={libreColors.card}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-xs font-medium ${libreColors.title}`}>
            Libre
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className={`text-lg font-bold ${libreColors.amount}`}>
            {formatCurrency(libre)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
