export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="space-y-3 text-center">
        <div className="inline-flex gap-1">
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
