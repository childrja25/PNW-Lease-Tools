import React, { useMemo } from 'react';

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseSF(val) {
  if (!val) return 0;
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

function getQuarterLabel(year, quarter) {
  return `Q${quarter} ${year}`;
}

function generateQuarters(startDate, months) {
  const quarters = [];
  let y = startDate.getFullYear();
  let q = Math.ceil((startDate.getMonth() + 1) / 3);

  const count = Math.ceil(months / 3);
  for (let i = 0; i < count; i++) {
    quarters.push({ year: y, quarter: q, label: getQuarterLabel(y, q) });
    q++;
    if (q > 4) { q = 1; y++; }
  }
  return quarters;
}

function getQuarterKey(date) {
  return `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
}

export default function Analytics({ leases }) {
  const { quarters, data, maxSF, totalExpiring, avgSF } = useMemo(() => {
    const now = new Date();
    const qs = generateQuarters(now, 60);
    const buckets = {};
    qs.forEach(q => { buckets[q.label] = 0; });

    let totalExp = 0;
    let totalSF = 0;

    leases.forEach(lease => {
      const exp = parseDate(lease.expiration_date);
      const sf = parseSF(lease.rentable_square_footage);
      if (!exp || sf <= 0) return;

      const key = getQuarterKey(exp);
      if (key in buckets) {
        buckets[key] += sf;
        totalExp++;
        totalSF += sf;
      }
    });

    const chartData = qs.map(q => ({ label: q.label, sf: buckets[q.label] }));
    const max = Math.max(...chartData.map(d => d.sf), 1);

    return {
      quarters: qs,
      data: chartData,
      maxSF: max,
      totalExpiring: totalExp,
      avgSF: totalExp > 0 ? Math.round(totalSF / totalExp) : 0,
    };
  }, [leases]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    if (maxSF <= 1) return [0];
    const step = Math.pow(10, Math.floor(Math.log10(maxSF)));
    const niceStep = maxSF / step < 2 ? step / 4 : maxSF / step < 5 ? step / 2 : step;
    const ticks = [];
    for (let v = 0; v <= maxSF * 1.1; v += niceStep) {
      ticks.push(Math.round(v));
    }
    if (ticks.length < 2) ticks.push(Math.round(maxSF));
    return ticks;
  }, [maxSF]);

  const chartTop = yTicks[yTicks.length - 1] || 1;

  function formatSF(val) {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'K';
    return val.toLocaleString();
  }

  const barWidth = Math.max(100 / data.length, 2);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <span className="text-sm text-gray-400">{leases.length} lease{leases.length !== 1 ? 's' : ''} indexed</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-navy-700 border border-gray-700 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Leases Expiring (60 mo)</div>
          <div className="text-2xl font-bold text-white">{totalExpiring}</div>
        </div>
        <div className="bg-navy-700 border border-gray-700 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Total SF Expiring</div>
          <div className="text-2xl font-bold text-white">{formatSF(data.reduce((s, d) => s + d.sf, 0))}</div>
        </div>
        <div className="bg-navy-700 border border-gray-700 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Avg SF / Lease</div>
          <div className="text-2xl font-bold text-white">{formatSF(avgSF)}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-navy-700 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Lease Expirations by Quarter</h2>
        <p className="text-xs text-gray-500 mb-6">Total square footage of leases expiring per quarter over the next 60 months</p>

        {data.every(d => d.sf === 0) ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No leases with expiration dates in the next 60 months.
          </div>
        ) : (
          <div className="relative">
            {/* Y-axis labels + grid */}
            <div className="flex">
              <div className="w-16 shrink-0 flex flex-col justify-between h-64 pr-2 text-right">
                {[...yTicks].reverse().map((tick, i) => (
                  <span key={i} className="text-[10px] text-gray-500 leading-none">{formatSF(tick)} SF</span>
                ))}
              </div>

              {/* Chart area */}
              <div className="flex-1 relative h-64 border-l border-b border-gray-600">
                {/* Horizontal grid lines */}
                {yTicks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute w-full border-t border-gray-700/50"
                    style={{ bottom: `${(tick / chartTop) * 100}%` }}
                  />
                ))}

                {/* Bars */}
                <div className="absolute inset-0 flex items-end">
                  {data.map((d, i) => {
                    const heightPct = (d.sf / chartTop) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      >
                        {/* Tooltip */}
                        {d.sf > 0 && (
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                            <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg border border-gray-600">
                              <div className="font-medium">{d.label}</div>
                              <div className="text-blue-300">{d.sf.toLocaleString()} SF</div>
                            </div>
                          </div>
                        )}
                        <div
                          className={`w-[60%] max-w-[40px] rounded-t transition-all duration-300 ${
                            d.sf > 0
                              ? 'bg-blue-500 hover:bg-blue-400 cursor-pointer'
                              : ''
                          }`}
                          style={{ height: `${Math.max(heightPct, d.sf > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex ml-16">
              {data.map((d, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[8px] text-gray-500 whitespace-nowrap -rotate-45 inline-block mt-2 origin-top-left">
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
