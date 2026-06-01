export function PocketsteadMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      alt=""
      className={className}
      src="/pocketstead-logo.png"
    />
  );
}

export function PocketsteadLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <PocketsteadMark className="h-8 w-8 shrink-0 rounded-lg" />
      <span>Pocketstead</span>
    </span>
  );
}
