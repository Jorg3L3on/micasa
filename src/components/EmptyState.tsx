type EmptyStateProps = {
  message: string
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground text-lg">{message}</p>
    </div>
  )
}
