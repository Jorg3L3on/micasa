import TaskListDetailView from '@/components/tasks/TaskListDetailView';
import Link from 'next/link';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TaskListDetailPage({ params }: PageProps) {
  const { id } = await params;
  const listId = Number.parseInt(id, 10);
  if (!Number.isFinite(listId) || listId <= 0) {
    return <div className="text-sm text-muted-foreground">Lista inválida.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/tasks/todo-lists"
          className="mb-2 inline-flex text-xs text-muted-foreground hover:text-foreground"
        >
          Volver a listas
        </Link>
        <h2 className="text-lg font-semibold leading-tight">Detalle de lista</h2>
        <p className="text-xs text-muted-foreground">Gestiona tareas y estados de esta lista.</p>
      </div>
      <TaskListDetailView listId={listId} />
    </div>
  );
}
