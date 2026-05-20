/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { format, isFuture, parseISO, isToday, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarEvent } from '../types';
import { TURKISH_HOLIDAYS } from '../constants';
import { AlertCircle, Trash2, Calendar as CalendarIcon, MapPin } from 'lucide-react';

interface Props {
  events: CalendarEvent[];
  onRemove: (id: string) => void;
}

export default function EventList({ events, onRemove }: Props) {
  // Combine user events with static holidays
  const allEvents = [...events, ...TURKISH_HOLIDAYS as CalendarEvent[]];
  
  const upcomingEvents = allEvents
    .filter(e => isFuture(parseISO(e.date)) || isToday(parseISO(e.date)))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-bold text-lg tracking-tight">Yaklaşan Etkinlikler</h3>
        <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
          {upcomingEvents.length} Etkinlik
        </span>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
          <p className="text-neutral-500 text-sm italic">Henüz yaklaşan bir etkinlik yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingEvents.map((event) => {
            const isHoliday = event.type === 'holiday';
            const eventDate = parseISO(event.date);
            
            return (
              <div 
                key={event.id}
                className={`group relative bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center gap-4 transition-all hover:border-neutral-700 ${isHoliday ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-red-500'}`}
              >
                <div className={`p-3 rounded-xl flex flex-col items-center justify-center min-w-[60px] ${isHoliday ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-tighter">
                    {format(eventDate, 'MMM', { locale: tr })}
                  </span>
                  <span className="text-xl font-black leading-none">
                    {format(eventDate, 'd')}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{event.title}</h4>
                  <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                    <CalendarIcon className="w-3 h-3" /> {format(eventDate, 'EEEE', { locale: tr })}
                    {event.time && <span> • {event.time}</span>}
                  </p>
                </div>

                {!isHoliday && (
                  <button 
                    onClick={() => onRemove(event.id)}
                    className="p-2 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
