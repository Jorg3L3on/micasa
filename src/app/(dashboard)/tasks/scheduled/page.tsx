import ScheduledTasksPageView from '@/components/tasks/ScheduledTasksPageView';

export default function TaskScheduledPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Tareas programadas</h2>
        <p className="text-xs text-muted-foreground">
          Gestiona tareas pendientes, con fechas y estados de avance.
        </p>
      </div>
      <ScheduledTasksPageView />
    </div>
  );
}
