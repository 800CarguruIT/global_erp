export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="loading-top-track">
        <div className="loading-top-bar" />
      </div>
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
          <div className="text-sm font-semibold tracking-wide text-slate-200">Loading page</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="loading-pulse-bar h-full rounded-full bg-cyan-400" />
          </div>
          <p className="text-xs text-slate-400">Preparing data and UI...</p>
        </div>
      </div>
    </div>
  );
}
