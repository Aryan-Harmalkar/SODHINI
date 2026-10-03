// Mock waste classifier. Deterministic for a given image + description, so the
// same photo always produces the same result. Swap `classify` for a real model
// call (e.g. a vision API) without touching the route handlers.

export const PTS_PER_RUPEE = 50; // 50 points = 1 Rs

export const CATEGORIES = [
  { key: 'overflowing_bin', emoji: '🗑️', label: 'Overflowing bin', points: 100, isHazardous: false,
    keywords: ['bin', 'overflow', 'dustbin', 'garbage', 'trash', 'smell', 'dump', 'litter', 'rubbish'] },
  { key: 'e_waste', emoji: '💻', label: 'E-waste', points: 200, isHazardous: true, hazardLevel: 'Medium',
    keywords: ['laptop', 'phone', 'battery', 'batteries', 'electronic', 'computer', 'tv', 'charger', 'wire', 'cable', 'e-waste', 'ewaste'] },
  { key: 'plastic_dry', emoji: '♻️', label: 'Plastic / dry', points: 75, isHazardous: false,
    keywords: ['plastic', 'bottle', 'packet', 'wrapper', 'cardboard', 'paper', 'dry', 'carton', 'can', 'polythene'] },
  { key: 'wet_organic', emoji: '🍌', label: 'Wet / organic', points: 50, isHazardous: false,
    keywords: ['food', 'organic', 'vegetable', 'fruit', 'wet', 'kitchen', 'banana', 'peel', 'leaves', 'rotten', 'compost'] },
  { key: 'hazardous', emoji: '☣️', label: 'Hazardous', points: 250, isHazardous: true, hazardLevel: 'High',
    keywords: ['chemical', 'medical', 'syringe', 'needle', 'paint', 'hazard', 'toxic', 'oil', 'acid', 'mask', 'bulb'] },
  { key: 'construction', emoji: '🧱', label: 'Construction debris', points: 150, isHazardous: false,
    keywords: ['debris', 'construction', 'brick', 'cement', 'rubble', 'sand', 'tiles', 'concrete'] },
  { key: 'bulky', emoji: '🛋️', label: 'Bulky waste', points: 150, isHazardous: false,
    keywords: ['sofa', 'mattress', 'furniture', 'couch', 'bed', 'fridge', 'chair', 'table', 'bulky', 'cupboard'] },
];

export function calculatePoints(tags = []) {
  if (!Array.isArray(tags) || tags.length === 0) return 50;
  // If any tag is hazardous, award top tier
  if (tags.some((t) => t.key === 'hazardous')) return 250;
  if (tags.some((t) => t.key === 'e_waste')) return 200;

  // Otherwise points correspond to the primary tag
  const primaryKey = tags[0]?.key || (typeof tags[0] === 'string' ? tags[0] : null);
  const found = CATEGORIES.find((c) => c.key === primaryKey);
  return found?.points || 50;
}

export function getPointsMeta(tags = []) {
  const points = calculatePoints(tags);
  const isHazardous = tags.some((t) => t.key === 'hazardous' || t.key === 'e_waste');
  const hazardLevel = tags.some((t) => t.key === 'hazardous')
    ? 'High'
    : tags.some((t) => t.key === 'e_waste')
      ? 'Medium'
      : 'None';
  const inr = Number((points / PTS_PER_RUPEE).toFixed(2));
  return {
    points,
    inr,
    rateText: '50 pts = ₹1',
    isHazardous,
    hazardLevel,
  };
}

const NOT_WASTE_HINTS = ['not waste', 'no waste', 'clean street', 'selfie', 'just testing'];

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function summarize(description) {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'No description provided.';
  const firstSentence = text.split(/(?<=[.!?])\s/)[0];
  const s = firstSentence.length > 140 ? `${firstSentence.slice(0, 137).trimEnd()}…` : firstSentence;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function classify({ image, description }) {
  const desc = String(description || '').toLowerCase();
  const sample = `${image.length}|${image.slice(-4000)}|${desc}`;
  const rand = mulberry32(hashString(sample));
  const between = (min, max) => Math.round(min + rand() * (max - min));

  const summary = summarize(description);

  if (NOT_WASTE_HINTS.some((h) => desc.includes(h))) {
    return { isWaste: false, tags: [], summary };
  }

  // Score categories by keyword hits in the description.
  const scored = CATEGORIES
    .map((c) => ({ c, hits: c.keywords.filter((k) => new RegExp(`\\b${k}`, 'i').test(desc)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  let ranked;
  if (scored.length) {
    ranked = scored.map((x) => x.c);
  } else {
    // No textual hints: pretend the "vision model" decided. ~20% not waste.
    if (rand() < 0.2) return { isWaste: false, tags: [], summary };
    const pool = [...CATEGORIES].sort(() => rand() - 0.5);
    ranked = pool.slice(0, 1 + Math.floor(rand() * 2));
  }

  const tags = ranked.slice(0, 3).map((c, i) => ({
    key: c.key,
    emoji: c.emoji,
    label: c.label,
    isHazardous: !!c.isHazardous,
    points: c.points,
    confidence: i === 0 ? between(82, 97) : between(38, 74 - i * 8),
  }));

  const pointsMeta = getPointsMeta(tags);

  return { isWaste: true, tags, pointsMeta, summary };
}
