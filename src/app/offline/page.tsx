export default function OfflinePage() {
  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center justify-center px-4">
      <div className="card max-w-md text-center">
        <h1 className="text-xl font-bold text-navy-900 mb-2">You're offline</h1>
        <p className="text-sm text-navy-900/70">
          Classroom Loop couldn't reach the network. Pages you've already opened stay available,
          and any evidence you save while offline is queued locally and synced automatically when
          connectivity returns — nothing you write is lost.
        </p>
      </div>
    </main>
  );
}
