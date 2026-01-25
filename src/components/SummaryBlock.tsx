import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle2, Clock } from 'lucide-react'

type SummaryBlockProps = {
  tenemos: number
  libre: number
  pagado: number
  pendiente: number
  userIncome?: Array<{
    fortnightId: number
    userIncome: Array<{ userId: number; userName: string; income: number }>
  }>
}

export default function SummaryBlock({
  tenemos,
  libre,
  pagado,
  pendiente,
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      {/* LEFT COLUMN - Tenemos */}
      <Card className="bg-purple-50/80 dark:bg-purple-950/30 border-purple-200/80 dark:border-purple-900/70 shadow-sm rounded-lg">
        <CardHeader className="pb-1.5 px-3 pt-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-purple-900 dark:text-purple-100">
            Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3 pb-2.5">
          {hasUserIncome ? (
            <div className="space-y-1.5 text-xs">
              {userIncome.map((fortnightIncome) => (
                <div key={fortnightIncome.fortnightId} className="space-y-1">
                  {fortnightIncome.userIncome.map((userInc) => (
                    <div
                      key={userInc.userId}
                      className="flex justify-between items-center"
                    >
                      <span className="text-purple-600 dark:text-purple-400 text-[11px]">
                        {userInc.userName}:
                      </span>
                      <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px] font-mono tabular-nums">
                        {formatCurrency(userInc.income)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="pt-1.5 border-t border-purple-200/80 dark:border-purple-800/70 mt-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-medium text-purple-900 dark:text-purple-100">
                    Total:
                  </span>
                  <span className="text-base md:text-lg font-bold text-purple-700 dark:text-purple-300 font-mono tabular-nums">
                    {formatCurrency(tenemos)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-base md:text-lg font-bold text-purple-700 dark:text-purple-300 font-mono tabular-nums">
              {formatCurrency(tenemos)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* RIGHT COLUMN - Libre, Pagado, Pendiente (stacked) */}
      <div className="flex flex-col gap-2.5 md:gap-3">
        {/* Libre */}
        <Card className={`${libreColors.card} shadow-sm rounded-lg`}>
          <CardHeader className="pb-1.5 px-3 pt-2">
            <CardTitle
              className={`text-[11px] font-semibold uppercase tracking-wide ${libreColors.title}`}
            >
              Libre
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2.5">
            <p
              className={`text-base md:text-lg font-bold font-mono tabular-nums ${libreColors.amount}`}
            >
              {formatCurrency(libre)}
            </p>
          </CardContent>
        </Card>

        {/* Pagado */}
        <Card className="bg-green-50/80 dark:bg-green-950/30 border-green-200/80 dark:border-green-900/70 shadow-sm rounded-lg">
          <CardHeader className="pb-1.5 px-3 pt-2">
            <CardTitle className="text-[11px] font-semibold text-green-900 dark:text-green-100 flex items-center gap-1.5 uppercase tracking-wide">
              <CheckCircle2 className="h-3 w-3" />
              Pagado
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2.5">
            <p className="text-base md:text-lg font-bold text-green-700 dark:text-green-300 font-mono tabular-nums">
              {formatCurrency(pagado)}
            </p>
          </CardContent>
        </Card>

        {/* Pendiente */}
        <Card className="bg-yellow-50/80 dark:bg-yellow-950/30 border-yellow-200/80 dark:border-yellow-900/70 shadow-sm rounded-lg">
          <CardHeader className="pb-1.5 px-3 pt-2">
            <CardTitle className="text-[11px] font-semibold text-yellow-900 dark:text-yellow-100 flex items-center gap-1.5 uppercase tracking-wide">
              <Clock className="h-3 w-3" />
              Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2.5">
            <p className="text-base md:text-lg font-bold text-yellow-700 dark:text-yellow-300 font-mono tabular-nums">
              {formatCurrency(pendiente)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
