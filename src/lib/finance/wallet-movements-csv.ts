import type { WalletMovement, WalletDetail } from '@/types/wallet-movements';

const csvEscape = (value: string) => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const buildWalletMovementsCsv = (
  wallet: WalletDetail,
  range: { from: string; to: string },
  movements: WalletMovement[],
): string => {
  const lines: string[] = [];
  lines.push('date,description,amount,category,type');
  for (const m of movements) {
    lines.push(
      [
        m.date,
        csvEscape(m.description),
        String(m.amount),
        csvEscape(m.category ?? ''),
        m.kind,
      ].join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
};

export const downloadWalletMovementsCsv = (
  wallet: WalletDetail,
  range: { from: string; to: string },
  movements: WalletMovement[],
) => {
  const blob = new Blob([buildWalletMovementsCsv(wallet, range, movements)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = wallet.name.replace(/[^\w\d-]+/g, '_').slice(0, 40);
  a.download = `billetera_${safe}_${range.from}_${range.to}.csv`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const buildWalletImportCsvTemplate = (): string => {
  const header = 'date,description,amount,category,type';
  const example = '2026-04-15,Ejemplo gasto,250.00,Alimentos,expense';
  const example2 = '2026-04-16,Ejemplo ingreso,1500.00,,income';
  return `\uFEFF${header}\n${example}\n${example2}`;
};

export const downloadWalletImportCsvTemplate = () => {
  const blob = new Blob([buildWalletImportCsvTemplate()], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_importacion_billetera.csv';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
