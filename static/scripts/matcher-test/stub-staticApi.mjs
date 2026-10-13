import { readFileSync } from 'node:fs';
export const loadCatalog = async () => ({ medications: [] });
export const inStockCatalog = (data) => data.medications;
export const loadWordList = async () => readFileSync(new URL('../../public/english-words.txt', import.meta.url), 'utf8');
