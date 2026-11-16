import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import writeExcelFile from 'write-excel-file/node';
import { demoDb } from '../data';
import { parseLocal } from '../dates';
import { buildClientExport, exportFileName } from '../exportClients';
import { hourOptions } from '../dates';

describe('eksport klientów do Excela', () => {
  const db = demoDb();
  db.bookings = [
    { id: 'x1', ownerId: 'o1', dogIds: ['d1', 'd2'], kennel: 1, arrival: parseLocal('2026-03-01', '10:00')!, departure: parseLocal('2026-03-03', '10:00')!, status: 'checked_out', total: 270, deposit: 81, paid: 270, createdAt: '' },
    { id: 'x2', ownerId: 'o1', dogIds: ['d1'], kennel: 2, arrival: parseLocal('2026-11-20', '00:30')!, departure: parseLocal('2026-11-22', '10:00')!, status: 'reserved', total: 140, deposit: 42, paid: 40, createdAt: '' },
    { id: 'x3', ownerId: 'o1', dogIds: ['d1'], kennel: 3, arrival: parseLocal('2026-12-01', '10:00')!, departure: parseLocal('2026-12-02', '10:00')!, status: 'cancelled', total: 70, deposit: 21, paid: 0, createdAt: '' },
  ];
  const [klienci, psy] = buildClientExport(db);
  const values = (row: unknown[]) => row.map(c => (c as { value: unknown }).value);

  it('arkusz Klienci: nagłówek, sortowanie po nazwisku, sumy bez anulowanych', () => {
    expect(values(klienci.data[0])[0]).toBe('Klient');
    expect(klienci.data.slice(1).map(r => values(r)[0])).toEqual(['Anna Kowalska', 'Jan Nowak', 'Maria Wiśniewska']);
    const anna = values(klienci.data[1]);
    expect(anna.slice(1, 5)).toEqual(['501 234 567', 'Luna, Borys', 2, 2]);
    expect(anna.slice(7, 10)).toEqual([410, 310, 100]);
  });

  it('daty jako dzień kalendarzowy (pobyt o 00:30 nie przeskakuje na poprzedni dzień)', () => {
    const anna = values(klienci.data[1]);
    expect((anna[5] as Date).toISOString().slice(0, 10)).toBe('2026-03-01');
    expect((anna[6] as Date).toISOString().slice(0, 10)).toBe('2026-11-20');
  });

  it('arkusz Psy: jeden wiersz na psa z właścicielem', () => {
    expect(psy.data).toHaveLength(1 + db.dogs.length);
    expect(values(psy.data[1]).slice(0, 5)).toEqual(['Borys', 'Anna Kowalska', '501 234 567', 'Duży', 32]);
  });

  it('tworzy poprawny plik .xlsx z dwoma arkuszami', async () => {
    const buf = await writeExcelFile(buildClientExport(db)).toBuffer();
    const files = unzipSync(new Uint8Array(buf));
    const workbook = strFromU8(files['xl/workbook.xml']);
    expect(workbook).toContain('name="Klienci"');
    expect(workbook).toContain('name="Psy"');
    const shared = strFromU8(files['xl/sharedStrings.xml'] ?? new Uint8Array());
    const sheet1 = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(shared + sheet1).toContain('Wiśniewska');
  });

  it('nazwa pliku', () => expect(exportFileName('2026-11-16')).toBe('psotelgracja-klienci-2026-11-16.xlsx'));
});

describe('godziny do wyboru', () => {
  it('od 08:00 do 20:30 co 30 minut', () => {
    expect(hourOptions[0]).toBe('08:00');
    expect(hourOptions[1]).toBe('08:30');
    expect(hourOptions.at(-1)).toBe('20:30');
    expect(hourOptions).toHaveLength(26);
  });
});
