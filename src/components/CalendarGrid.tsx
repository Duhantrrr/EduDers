/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarEvent } from '../types';
import { TURKISH_HOLIDAYS } from '../constants';

interface Props {
  events: CalendarEvent[];
}

export default function CalendarGrid({ events }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const allEvents = [...events, ...TURKISH_HOLIDAYS as CalendarEvent[]];

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold capitalize tracking-tight">
          {format(currentMonth, 'MMMM yyyy', { locale: tr })}
        </h2>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => (
          <div key={day} className="text-center text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const dayEvents = allEvents.filter(e => isSameDay(new Date(e.date), day));
          const isCurrentToday = isToday(day);
          
          return (
            <div
              key={day.toISOString()}
              className={`aspect-square relative flex flex-col items-center justify-center rounded-xl transition-all ${
                isSameMonth(day, currentMonth) ? 'hover:bg-neutral-800/50' : 'opacity-20'
              } ${isCurrentToday ? 'bg-emerald-500/10 border border-emerald-500/30' : ''}`}
            >
              <span className={`text-sm font-medium ${isCurrentToday ? 'text-emerald-400' : 'text-neutral-300'}`}>
                {format(day, 'd')}
              </span>
              
              {dayEvents.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {dayEvents.slice(0, 3).map(e => (
                    <div 
                      key={e.id} 
                      className={`w-1.5 h-1.5 rounded-full ${
                        e.type === 'exam' ? 'bg-red-500' : 
                        e.type === 'holiday' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} 
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
