import type { Perfume } from "@/data/mockData";

/** Normaliza string: minúsculas, sem acentos, sem caracteres especiais, espaços simples */
export function normalize(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens significativos (>=2 chars), removendo stopwords comuns */
const STOPWORDS = new Set(["de", "da", "do", "para", "the", "le", "la", "el", "of", "and", "e", "ml"]);
export function tokens(str: string): string[] {
  return normalize(str)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Singular básico (remove 's' final em palavras com >3 chars) */
function singularize(t: string): string {
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

/** Distância de Levenshtein */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

/** Similaridade entre tokens (1 - normalized levenshtein), considera singular/plural */
function tokenSim(a: string, b: string): number {
  const sa = singularize(a);
  const sb = singularize(b);
  if (sa === sb) return 1;
  const maxLen = Math.max(sa.length, sb.length);
  if (!maxLen) return 0;
  const dist = levenshtein(sa, sb);
  return 1 - dist / maxLen;
}

/** Jaccard sobre tokens fuzzy (match por similaridade >= 0.8) */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const used = new Set<number>();
  let matches = 0;
  for (const x of ta) {
    let bestIdx = -1;
    let bestScore = 0;
    tb.forEach((y, i) => {
      if (used.has(i)) return;
      const s = tokenSim(x, y);
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    });
    if (bestScore >= 0.8 && bestIdx >= 0) {
      matches++;
      used.add(bestIdx);
    }
  }
  const union = ta.length + tb.length - matches;
  return union > 0 ? matches / union : 0;
}

export interface SimilarityCandidate {
  perfume: Perfume;
  score: number;     // 0..1
  reasons: string[]; // marca/concentração/volume
}

export interface SimilarityInput {
  nome: string;
  marca: string;
  casaSigla: string;
  concentracao: string;
  volume: number;
}

/**
 * Avalia similaridade entre o produto novo e os existentes.
 * Pondera: nome (60%), marca/casa (20%), concentração (10%), volume (10%).
 */
export function findSimilarProducts(
  input: SimilarityInput,
  perfumes: Perfume[],
  threshold = 0.8,
): SimilarityCandidate[] {
  const candidates: SimilarityCandidate[] = [];

  for (const p of perfumes) {
    const reasons: string[] = [];

    const nomeScore = nameSimilarity(input.nome, p.nome);

    const marcaSame =
      normalize(input.marca) === normalize(p.marca) ||
      input.casaSigla === p.casaSigla;
    const marcaScore = marcaSame ? 1 : nameSimilarity(input.marca, p.marca);
    if (marcaSame) reasons.push("mesma marca");

    const concSame = input.concentracao === p.concentracao;
    if (concSame) reasons.push("mesma concentração");

    const volSame = Number(input.volume) === Number(p.volume);
    if (volSame) reasons.push(`mesmo volume (${p.volume}ml)`);

    const score =
      nomeScore * 0.6 +
      marcaScore * 0.2 +
      (concSame ? 0.1 : 0) +
      (volSame ? 0.1 : 0);

    // Boost: se nome muito alto (>=0.9) e mesma marca, considera match forte
    const finalScore = nomeScore >= 0.9 && marcaSame ? Math.max(score, 0.92) : score;

    if (finalScore >= threshold) {
      if (nomeScore >= 0.6) reasons.unshift(`nome ${(nomeScore * 100).toFixed(0)}% similar`);
      candidates.push({ perfume: p, score: finalScore, reasons });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}
