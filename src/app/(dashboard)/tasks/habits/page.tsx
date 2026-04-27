import HabitsPageView from '@/components/tasks/HabitsPageView';

export default function TaskHabitsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Hábitos</h2>
        <p className="text-xs text-muted-foreground">
          Registra hábitos, marca cumplimiento y monitorea rachas.
        </p>
      </div>
      <HabitsPageView />
    </div>
  );
}
