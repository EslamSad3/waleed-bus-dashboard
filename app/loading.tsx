export default function Loading() {
  return (
    <div className="page-bg" aria-busy="true" aria-label="جاري التحميل">
      <div className="mx-auto max-w-6xl animate-pulse px-4 py-10">
        <div className="h-8 w-2/3 rounded-xl bg-slate-300/70" />
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200/80" />
          ))}
        </div>
        <div className="mt-6 h-40 rounded-2xl bg-slate-300/60" />
      </div>
    </div>
  );
}
