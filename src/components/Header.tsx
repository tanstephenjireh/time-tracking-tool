import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-white border-b border-purple-100 px-4 py-4 z-10">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="font-black text-xl text-[#7B2CBF] tracking-tight truncate">
          TimeTracker.
        </Link>
        <nav className="flex gap-2">
          <Link href="/" className="px-3 py-1.5 bg-[#FDE047] text-slate-900 rounded-full text-xs font-bold shadow-sm truncate hover:bg-yellow-400 transition-colors">
            Dashboard
          </Link>
          <Link href="/settings/sync" className="px-3 py-1.5 text-slate-500 rounded-full text-xs font-bold hover:bg-slate-100 truncate transition-colors">
            Sync Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
