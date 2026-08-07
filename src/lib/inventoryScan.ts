import type { Product } from './types';

export interface ScannedLine {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  cost: number;
  price: number;
  min_stock: number;
  /** matched existing product id if duplicate */
  matchId: string | null;
  matchName: string | null;
  action: 'update' | 'create' | 'skip';
  confidence: number;
  raw: string;
}

/** Normalise pour détecter doublons (Flag = FLAG = flag 65cl…) */
export function normalizeProductKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(bouteille|bout|bt|cl|ml|casier|csr|x)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findDuplicate(name: string, products: Product[]): Product | null {
  const key = normalizeProductKey(name);
  if (!key) return null;
  // exact normalized
  let best: Product | null = null;
  let bestScore = 0;
  for (const p of products) {
    const pk = normalizeProductKey(p.name);
    if (!pk) continue;
    if (pk === key) return p;
    // contains
    if (pk.includes(key) || key.includes(pk)) {
      const score = Math.min(pk.length, key.length) / Math.max(pk.length, key.length);
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        best = p;
      }
    }
  }
  return best;
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/coca|fanta|sprite|soda|eau|jus|boisson|malta|tonic|schweppes/.test(n)) return 'Soft';
  if (/vin|whisky|vodka|ricard|pastis|gin|rhum|liqueur/.test(n)) return 'Spiritueux';
  if (/biere|bière|bock|castel|flag|beaufort|doppel|desperados|heineken|guinness|amate|ivoiro/.test(n))
    return 'Alcool';
  return 'Autre';
}

function guessUnit(name: string, raw: string): string {
  const t = `${name} ${raw}`.toLowerCase();
  if (/65\s*cl|66/.test(t)) return 'Bouteille 65cl';
  if (/50\s*cl/.test(t)) return 'Bouteille 50cl';
  if (/33\s*cl|25\s*cl/.test(t)) return 'Bouteille 33cl';
  if (/casier/.test(t)) return 'Casier';
  return 'Bouteille';
}

/** Parse texte OCR → lignes produits */
export function parseInventoryText(text: string, existing: Product[]): ScannedLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const results: ScannedLine[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    // ignore headers
    if (/^(cat[eé]gorie|produit|marque|format|qte|qt[eé]|stock|prix|valeur|casier|n[°o]|total)/i.test(raw))
      continue;
    if (/^[\d\s.,]+$/.test(raw)) continue;

    // Pattern: name ... numbers
    // e.g. "Flag 65cl 48 2 450 600" or "BOCK 66  12"
    const nums = [...raw.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) =>
      parseFloat(m[1].replace(',', '.'))
    );
    let namePart = raw
      .replace(/(\d+(?:[.,]\d+)?)/g, ' ')
      .replace(/[|•·]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // clean leftover
    namePart = namePart.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '');
    if (namePart.length < 2) continue;
    if (namePart.length > 80) namePart = namePart.slice(0, 80);

    const key = normalizeProductKey(namePart);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    // Heuristic numbers: stock often first medium number; prices 200-5000
    let stock = 0;
    let cost = 0;
    let price = 0;
    const candidates = nums.filter((n) => !Number.isNaN(n));
    for (const n of candidates) {
      if (n >= 1 && n <= 500 && stock === 0) stock = Math.round(n);
      else if (n >= 100 && n <= 20000) {
        if (cost === 0) cost = Math.round(n);
        else if (price === 0) price = Math.round(n);
      }
    }
    // if only one big number and no stock-like, might be price only
    if (stock === 0 && candidates.length === 1 && candidates[0] <= 500) {
      stock = Math.round(candidates[0]);
    }

    const dup = findDuplicate(namePart, existing);
    const conf =
      (stock > 0 ? 0.35 : 0.15) +
      (namePart.length >= 3 ? 0.35 : 0.1) +
      (dup ? 0.2 : 0.1) +
      (cost > 0 || price > 0 ? 0.1 : 0);

    results.push({
      id: `scan-${results.length}-${Date.now()}`,
      name: namePart,
      category: guessCategory(namePart),
      unit: guessUnit(namePart, raw),
      stock,
      cost: cost || (dup ? Number(dup.cost) : 0),
      price: price || (dup ? Number(dup.price) : 0),
      min_stock: dup ? Number(dup.min_stock) || 12 : 12,
      matchId: dup?.id ?? null,
      matchName: dup?.name ?? null,
      action: dup ? 'update' : 'create',
      confidence: Math.min(0.98, conf),
      raw,
    });
  }

  return results.slice(0, 80);
}

export async function runOcrFrench(file: File | Blob): Promise<string> {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(file, 'fra', {
    logger: () => {},
  });
  return result.data.text || '';
}
