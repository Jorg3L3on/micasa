import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

type SummaryBlockProps = {
  tenemos: number
  libre: number
  userIncome?: Array<{
    fortnightId: number
    userIncome: Array<{ userId: number; userName: string; income: number }>
  }>
}

export default function SummaryBlock({
  tenemos,
  libre,
  userIncome,
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

  // Calculate total from user income if available, otherwise use tenemos
  const hasUserIncome = userIncome && userIncome.length > 0 && userIncome.some(fi => fi.userIncome && fi.userIncome.length > 0)

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-purple-900 dark:text-purple-100">
            Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {hasUserIncome ? (
            <div className="space-y-2">
              {userIncome.map((fortnightIncome) => (
                <div key={fortnightIncome.fortnightId} className="space-y-1.5">
                  {fortnightIncome.userIncome.map((userInc) => (
                    <div
                      key={userInc.userId}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-purple-600 dark:text-purple-400 text-xs">
                        {userInc.userName}:
                      </span>
                      <span className="font-semibold text-purple-700 dark:text-purple-300 text-xs">
                        {formatCurrency(userInc.income)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="pt-2 border-t border-purple-200 dark:border-purple-800 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-purple-900 dark:text-purple-100">
                    Total:
                  </span>
                  <span className="text-lg font-bold text-purple-700 dark:text-purple-300">
                    {formatCurrency(tenemos)}
                  </span>
                </div>
              </div>
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
