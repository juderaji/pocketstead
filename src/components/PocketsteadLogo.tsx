export function PocketsteadMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M8.5 14 16 8l7.5 6"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <path
        d="M9 15.5h14v2.25a7 7 0 0 1-14 0V15.5Z"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

export function PocketsteadLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <PocketsteadMark className="h-8 w-8 shrink-0 text-primary" />
      <span>Pocketstead</span>
    </span>
  );
}
