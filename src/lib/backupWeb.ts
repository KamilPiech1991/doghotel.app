// Pobieranie i wczytywanie pliku kopii zapasowej w przeglądarce.

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickTextFile(): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tworzy plik Excela z listą klientów i psów i pobiera go. Biblioteka ładowana dopiero przy eksporcie. */
export async function downloadClientsXlsx(sheets: import('./exportClients').ExportSheet[], filename: string) {
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  const blob = await writeExcelFile(sheets).toBlob();
  downloadBlob(filename, blob);
}
