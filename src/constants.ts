/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalendarEvent } from './types';

// Static Turkish Holidays for 2026
export const TURKISH_HOLIDAYS: Partial<CalendarEvent>[] = [
  { id: 'h1', title: '1 Ocak Yılbaşı', date: '2026-01-01', type: 'holiday', confirmed: true },
  { id: 'h2', title: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı', date: '2026-04-23', type: 'holiday', confirmed: true },
  { id: 'h3', title: '1 Mayıs Emek ve Dayanışma Günü', date: '2026-05-01', type: 'holiday', confirmed: true },
  { id: 'h4', title: '19 Mayıs Atatürk\'ü Anma, Gençlik ve Spor Bayramı', date: '2026-05-19', type: 'holiday', confirmed: true },
  { id: 'h-kurban', title: 'Kurban Bayramı', date: '2026-05-27', type: 'holiday', confirmed: true },
  { id: 'h5', title: '15 Temmuz Demokrasi ve Milli Birlik Günü', date: '2026-07-15', type: 'holiday', confirmed: true },
  { id: 'h6', title: '30 Ağustos Zafer Bayramı', date: '2026-08-30', type: 'holiday', confirmed: true },
  { id: 'h7', title: '29 Ekim Cumhuriyet Bayramı', date: '2026-10-29', type: 'holiday', confirmed: true },
];

export const COUNTDOWN_DATES = [
  { title: 'LGS Sınavı', date: '2026-06-07' },
  { title: 'Yaz Tatili', date: '2026-06-12' },
  { title: 'Kurban Bayramı', date: '2026-05-27' },
];
