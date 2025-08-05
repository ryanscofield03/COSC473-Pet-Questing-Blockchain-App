// NOTE: This was written by ChatGPT to style pets deterministically and check if the colour is light or dark

export function getPetColor(pet_id: String) {
  let hash = 0;
  for (let i = 0; i < pet_id.length; i++) {
    hash = pet_id.charCodeAt(i) + ((hash << 5) - hash);
  }

  const palettes = [
    ["#FF9AA2", "#FFB7B2", "#FFDAC1", "#E2F0CB", "#B5EAD7", "#C7CEEA"],
    ["#FFBE0B", "#FB5607", "#FF006E", "#8338EC", "#3A86FF", "#38B000"],
    ["#5F0F40", "#9A031E", "#FB8B24", "#E36414", "#0F4C5C", "#5F0F40"],
    ["#390099", "#9E0059", "#FF0054", "#FF5400", "#FFBD00", "#006E7F"]
  ];

  const paletteIndex = Math.abs(hash) % palettes.length;
  const colorIndex = Math.abs(hash >> 8) % palettes[paletteIndex].length;

  return palettes[paletteIndex][colorIndex];
}

export function getPetPattern(pet_id: String) {
  const hash = Array.from(pet_id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const patterns = [
    "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)",
    "repeating-radial-gradient(circle at 50% 50%, transparent 10px, rgba(255,255,255,0.1) 20px)",
    "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 60%)",
    "linear-gradient(to right, rgba(0,0,0,0.05), rgba(0,0,0,0), rgba(0,0,0,0.05))",
    "none"
  ];

  return patterns[hash % patterns.length];
}

export function isColorDark(color: string) {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness < 128;
}