type TableColumn<T> = {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
  className?: string
}

type TableProps<T> = {
  columns: TableColumn<T>[]
  data: T[]
  getRowId: (row: T) => string | number
}

export default function Table<T extends Record<string, any>>({
  columns,
  data,
  getRowId,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row) => (
            <tr key={getRowId(row)} className="hover:bg-gray-50">
              {columns.map((column, colIndex) => {
                const cellContent =
                  typeof column.accessor === 'function'
                    ? column.accessor(row)
                    : row[column.accessor]

                return (
                  <td
                    key={colIndex}
                    className={`px-6 py-4 text-sm ${
                      column.className || 'text-gray-900'
                    }`}
                  >
                    {cellContent}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
