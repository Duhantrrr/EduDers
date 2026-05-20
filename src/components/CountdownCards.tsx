/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { differenceInDays, parseISO } from 'date-fns';
import { COUNTDOWN_DATES } from '../constants';
import { Clock } from 'lucide-react';

export default function CountdownCards() {
  const now = new Date();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {COUNTDOWN_DATES.map((item, idx) => {
        const targetDate = parseISO(item.date);
        const daysLeft = differenceInDays(targetDate, now);

        if (daysLeft < 0) return null;

        const colors = [
          'from-emerald-500 to-teal-600',
          'from-blue-500 to-indigo-600',
          'from-orange-500 to-amber-600'
        ];

        return (
          <div 
            key={idx} 
            className="relative overflow-hidden bg-neutral-900 border border-neutral-800 p-5 rounded-3xl flex flex-col items-center text-center gap-1 group"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colors[idx % colors.length]} opacity-5 blur-2xl -mr-8 -mt-8`} />
            
            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">{item.title}</span>
            <div className="flex items-baseline gap-1 py-1">
              <span className={`text-4xl font-black bg-gradient-to-br ${colors[idx % colors.length]} bg-clip-text text-transparent`}>
                {daysLeft}
              </span>
              <span className="text-xs font-bold text-neutral-500">GÜN</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-600">
              <Clock className="w-3 h-3" />
              <span>KALDI</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
