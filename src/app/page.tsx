'use client';
import { useState, useEffect } from 'react';
import { ChartBar } from '@/components/ChartBar';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterEmp, setFilterEmp] = useState('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(d => setEmployees(d.employees || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterEmp !== 'all') params.set('employeeEmail', filterEmp);
    if (filterStart) params.set('startDate', new Date(filterStart).toISOString());
    if (filterEnd) params.set('endDate', new Date(filterEnd).toISOString());

    fetch(`/api/dashboard/stats?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setStats(d);
        setLoading(false);
      });
  }, [filterEmp, filterStart, filterEnd]);

  const totalMinutes = stats?.allocationsByCategory.reduce((acc: number, cur: any) => acc + cur.durationMinutes, 0) || 0;
  const totalHoursStr = (totalMinutes / 60).toFixed(1);

  // Sort for top displays
  const sortedCats = [...(stats?.allocationsByCategory || [])].sort((a, b) => b.durationMinutes - a.durationMinutes);
  const topCat = sortedCats.length > 0 ? sortedCats[0].category : '-';
  
  const sortedClients = [...(stats?.allocationsByClient || [])].sort((a, b) => b.durationMinutes - a.durationMinutes);
  const topClient = sortedClients.length > 0 ? sortedClients[0].companyName : '-';

  return (
    <div className="space-y-6">
      
      {/* Conversational Filter Bar */}
      <div className="text-lg font-medium text-slate-600 py-4 flex flex-wrap items-center gap-y-2">
        <span>Showing time allocation for</span>
        <select 
          className="appearance-none inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full cursor-pointer hover:bg-yellow-200 transition-colors font-bold text-sm mx-1 outline-none border-none text-center"
          value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
        >
          <option value="all">All Team Members ▾</option>
          {employees.map(e => <option key={e.id} value={e.email}>{e.name} ▾</option>)}
        </select>
        <span>between</span>
        <input 
          type="date" 
          className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full cursor-pointer hover:bg-yellow-200 transition-colors font-bold text-sm mx-1 outline-none border-none" 
          value={filterStart} onChange={e => setFilterStart(e.target.value)} 
        />
        <span>and</span>
        <input 
          type="date" 
          className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full cursor-pointer hover:bg-yellow-200 transition-colors font-bold text-sm mx-1 outline-none border-none" 
          value={filterEnd} onChange={e => setFilterEnd(e.target.value)} 
        />
        <span>.</span>
      </div>

      {loading ? (
        <div className="py-20 text-center font-bold text-slate-400 tracking-wider text-sm">LOADING DATA...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#7B2CBF] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden min-w-0">
              <div className="text-xs font-bold text-purple-200 truncate">TOTAL HOURS</div>
              <div className="text-4xl font-black mt-2 truncate">
                {totalHoursStr.replace('.0', '')}<span className="text-xl text-purple-300">h</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 min-w-0">
              <div className="text-xs font-bold text-slate-400 truncate">TOP CATEGORY</div>
              <div className="text-xl font-black text-slate-800 mt-2 truncate">{topCat}</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 min-w-0">
              <div className="text-xs font-bold text-slate-400 truncate">TOP CLIENT</div>
              <div className="text-xl font-black text-slate-800 mt-2 truncate">{topClient}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 min-w-0">
              <h3 className="text-sm font-black tracking-wider text-slate-400 mb-6 truncate">TIME BY CATEGORY</h3>
              <ChartBar 
                data={sortedCats.map(c => ({...c, hours: (c.durationMinutes/60).toFixed(1).replace('.0', '')}))} 
                labelKey="category" 
                valueKey="hours" 
                valueLabel="h" 
                theme="purple"
              />
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 min-w-0">
              <h3 className="text-sm font-black tracking-wider text-slate-400 mb-6 truncate">TIME BY CLIENT</h3>
              <ChartBar 
                data={sortedClients.map(c => ({...c, hours: (c.durationMinutes/60).toFixed(1).replace('.0', '')}))} 
                labelKey="companyName" 
                valueKey="hours" 
                valueLabel="h" 
                theme="yellow"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
