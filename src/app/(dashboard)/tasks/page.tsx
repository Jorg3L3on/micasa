import TasksOverview from '@/components/tasks/TasksOverview';

export default function TasksPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Tareas</h2>
        <p className="text-xs text-muted-foreground">
          Resumen de listas, tareas programadas, hábitos y rutinas diarias.
        </p>
      </div>
      <TasksOverview />
    </div>
  );
}
