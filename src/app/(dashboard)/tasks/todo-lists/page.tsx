import TaskListsPageView from '@/components/tasks/TaskListsPageView';

export default function TaskTodoListsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Listas de tareas</h2>
        <p className="text-xs text-muted-foreground">
          Crea y administra tus listas para organizar pendientes.
        </p>
      </div>
      <TaskListsPageView />
    </div>
  );
}
