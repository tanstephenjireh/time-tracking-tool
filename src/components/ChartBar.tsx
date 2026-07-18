export function ChartBar({ 
  data, 
  labelKey, 
  valueKey, 
  valueLabel, 
  theme = 'purple' 
}: { 
  data: any[], 
  labelKey: string, 
  valueKey: string, 
  valueLabel: string,
  theme?: 'purple' | 'yellow'
}) {
  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);

  const themeClasses = {
    purple: {
      text: 'text-[#7B2CBF]',
      bgMain: 'bg-[#7B2CBF]',
      bgLight: 'bg-purple-100'
    },
    yellow: {
      text: 'text-yellow-600',
      bgMain: 'bg-[#FDE047]',
      bgLight: 'bg-yellow-100'
    }
  };

  const classes = themeClasses[theme];

  return (
    <div className="space-y-4">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-bold text-slate-700 truncate pr-2">{item[labelKey] || 'Unknown'}</span>
            <span className={`${classes.text} font-bold shrink-0`}>{item[valueKey]}{valueLabel}</span>
          </div>
          <div className={`w-full ${classes.bgLight} rounded-full h-3`}>
            <div 
              className={`${classes.bgMain} h-3 rounded-full transition-all duration-500`} 
              style={{ width: `${(item[valueKey] / maxVal) * 100}%` }}
            ></div>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="text-slate-400 font-bold text-sm py-4">No data available.</div>}
    </div>
  );
}
