import RoutinesPageView from '@/components/tasks/RoutinesPageView';

export default function TaskRoutinesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Rutinas diarias</h2>
        <p className="text-xs text-muted-foreground">
          Define tus rutinas y ejecútalas paso a paso.
        </p>
      </div>
      <RoutinesPageView />
    </div>
  );
}
