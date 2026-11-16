// Dane do eksportu listy klientów i psów do Excela (bez zależności od interfejsu – testowalne).
import type { Row, SheetData } from 'write-excel-file/universal';
import { DB, sizeLabel } from './types';
import { localDateKey } from './dates';

export type ExportSheet = { sheet: string; data: SheetData; columns: { width: number }[]; stickyRowsCount: number };

const head = (labels: string[]): Row => labels.map(value => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E9F4EC' }));
const text = (v: string | undefined | null) => ({ value: v ?? '', type: String });
const num = (v: number) => ({ value: Math.round(v * 100) / 100, type: Number, format: '#,##0.00' });
const int = (v: number) => ({ value: v, type: Number });
/** Data jako dzień kalendarzowy (bez przesunięcia strefy czasowej w Excelu). */
const day = (iso: string | undefined) => {
  if (!iso) return { value: '' };
  const [y, m, d] = localDateKey(iso).split('-').map(Number);
  return { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: 'dd.mm.yyyy' };
};

export function buildClientExport(db: DB): ExportSheet[] {
  const active = db.bookings.filter(b => b.status !== 'cancelled');
  const owners = [...db.owners].sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  const clientRows: SheetData = [
    head(['Klient', 'Telefon', 'Psy', 'Liczba psów', 'Liczba pobytów', 'Pierwszy pobyt', 'Ostatni pobyt', 'Suma za pobyty (zł)', 'Wpłacono (zł)', 'Do zapłaty (zł)', 'Uwagi']),
    ...owners.map(o => {
      const dogs = db.dogs.filter(d => d.ownerId === o.id);
      const stays = active.filter(b => b.ownerId === o.id).sort((a, b) => a.arrival.localeCompare(b.arrival));
      const total = stays.reduce((s, b) => s + (b.total ?? 0), 0);
      const paid = stays.reduce((s, b) => s + b.paid, 0);
      const due = stays.reduce((s, b) => s + Math.max(0, (b.total ?? 0) - b.paid), 0);
      return [
        text(o.name), text(o.phone), text(dogs.map(d => d.name).join(', ')), int(dogs.length), int(stays.length),
        day(stays[0]?.arrival), day(stays.at(-1)?.arrival), num(total), num(paid), num(due), text(o.notes),
      ];
    }),
  ];

  const dogRows: SheetData = [
    head(['Pies', 'Klient', 'Telefon', 'Wielkość', 'Waga (kg)', 'Rasa', 'Liczba pobytów', 'Ostatni pobyt', 'Uwagi']),
    ...owners.flatMap(o =>
      db.dogs
        .filter(d => d.ownerId === o.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
        .map(d => {
          const stays = active.filter(b => b.dogIds.includes(d.id)).sort((a, b) => a.arrival.localeCompare(b.arrival));
          const weight = d.weight ? Number(d.weight.replace(',', '.')) : NaN;
          return [
            text(d.name), text(o.name), text(o.phone), text(sizeLabel[d.size]),
            Number.isFinite(weight) ? num(weight) : text(d.weight), text(d.breed), int(stays.length), day(stays.at(-1)?.arrival), text(d.notes),
          ];
        }),
    ),
  ];

  return [
    { sheet: 'Klienci', data: clientRows, columns: [28, 16, 26, 11, 14, 14, 14, 18, 14, 15, 36].map(width => ({ width })), stickyRowsCount: 1 },
    { sheet: 'Psy', data: dogRows, columns: [18, 28, 16, 11, 10, 18, 14, 14, 36].map(width => ({ width })), stickyRowsCount: 1 },
  ];
}

export const exportFileName = (todayKey: string) => `psotelgracja-klienci-${todayKey}.xlsx`;
