import TasksModuleShell from '@/components/tasks/TasksModuleShell';

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TasksModuleShell>{children}</TasksModuleShell>;
}
