// Rozpoznawanie mowy w przeglądarce (Web Speech API) – po polsku.
// Chrome na Androidzie i Safari na iPhonie mają je wbudowane. Gdy brak – zostaje pole tekstowe
// (można dyktować mikrofonem z klawiatury telefonu).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; length: number; [i: number]: RecognitionAlternative };
type RecognitionEvent = { resultIndex: number; results: { length: number; [i: number]: RecognitionResult } };
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

const getCtor = (): (new () => Recognition) | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechSupported = () => !!getCtor();

const errorText: Record<string, string> = {
  'not-allowed': 'Brak dostępu do mikrofonu. Zezwól na mikrofon dla tej strony w ustawieniach przeglądarki.',
  'service-not-allowed': 'Rozpoznawanie mowy jest wyłączone w tej przeglądarce. Użyj mikrofonu na klawiaturze.',
  'no-speech': 'Nic nie usłyszałem. Naciśnij mikrofon i powiedz polecenie.',
  'audio-capture': 'Nie znaleziono mikrofonu.',
  network: 'Rozpoznawanie mowy potrzebuje internetu. Sprawdź połączenie.',
};

/**
 * onFinal dostaje kilka wersji rozpoznanego tekstu (najbardziej prawdopodobna pierwsza),
 * żeby ekran mógł wybrać tę, w której rozpoznano psa i daty.
 */
export function useSpeech(onFinal: (alternatives: string[]) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const rec = useRef<Recognition | null>(null);
  const finalCb = useRef(onFinal);
  finalCb.current = onFinal;

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return setError('Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj mikrofonu na klawiaturze telefonu.');
    rec.current?.abort();
    const r = new Ctor();
    r.lang = 'pl-PL';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 5;
    let finals: string[][] = [];
    r.onresult = e => {
      let live = '';
      finals = [];
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.push(Array.from({ length: res.length }, (_, k) => res[k].transcript));
        else live += res[0].transcript;
      }
      setInterim([finals.map(f => f[0]).join(' '), live].join(' ').trim());
    };
    r.onerror = e => {
      if (e.error !== 'aborted') setError(errorText[e.error] ?? `Błąd rozpoznawania mowy (${e.error}).`);
    };
    r.onend = () => {
      setListening(false);
      if (finals.length) {
        // warianty: najlepszy tekst + alternatywy ostatniego fragmentu
        const best = finals.map(f => f[0]).join(' ').trim();
        const head = finals.slice(0, -1).map(f => f[0]).join(' ');
        const alts = finals[finals.length - 1].map(a => `${head} ${a}`.trim());
        finalCb.current([best, ...alts.filter(a => a !== best)]);
      }
    };
    setError('');
    setInterim('');
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Nie udało się uruchomić mikrofonu. Spróbuj ponownie.');
    }
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { listening, interim, error, start, stop, supported: speechSupported() };
}
