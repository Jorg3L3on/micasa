import { fetchFromApi } from '@/lib/api-server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/EmptyState';
import { formatCurrency } from '@/lib/utils';

type Summary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
};

type CategoryTotal = {
  category: string;
  total: number;
};

async function getSummary(): Promise<Summary> {
  try {
    return await fetchFromApi<Summary>('/api/reports?type=summary');
  } catch (error) {
    console.error('Error fetching summary:', error);
    return { totalIncome: 0, totalExpense: 0, balance: 0 };
  }
}

async function getByCategory(): Promise<CategoryTotal[]> {
  try {
    return await fetchFromApi<CategoryTotal[]>('/api/reports?type=by-category');
  } catch (error) {
    console.error('Error fetching category totals:', error);
    return [];
  }
}

export default async function DashboardPage() {
  const summary = await getSummary();
  const byCategory = await getByCategory();

  return (
    <>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(summary.totalIncome)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {formatCurrency(summary.totalExpense)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${
                summary.balance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(summary.balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gastos por categoría</CardTitle>
        </CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <EmptyState message="No hay datos de categorías disponibles" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCategory.map((item) => (
                  <TableRow key={item.category}>
                    <TableCell className="font-medium">
                      {item.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
