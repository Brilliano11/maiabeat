import type { MoodItem } from "@/lib/types";

export const moodItems: MoodItem[] = [
  { slug: "chill", name: "Chill", description: "Santai, ringan, dan enak buat napas.", color: "#00C2FF" },
  { slug: "workout", name: "Workout", description: "Beat tegas buat gerak lebih lama.", color: "#29FF87" },
  { slug: "focus", name: "Focus", description: "Alur tenang buat kerja dan belajar.", color: "#FFD600" },
  { slug: "night-drive", name: "Night Drive", description: "Synth, rock, dan pop malam.", color: "#111111" },
  { slug: "sad", name: "Sad", description: "Lagu pelan untuk hari yang berat.", color: "#FF3B6B" },
  { slug: "romantic", name: "Romantic", description: "Hangat, manis, dan personal.", color: "#FF4D00" },
  { slug: "rock", name: "Rock", description: "Gitar besar dan chorus keras.", color: "#FFD600" },
  { slug: "pop", name: "Pop", description: "Hook cepat nempel.", color: "#00C2FF" },
  { slug: "alternative", name: "Alternative", description: "Rasa beda tanpa terlalu jauh.", color: "#29FF87" },
  { slug: "indo-hits", name: "Indo Hits", description: "Pilihan Indonesia yang familiar.", color: "#FF4D00" },
  { slug: "j-pop", name: "J-Pop", description: "Melodi cerah dan detail rapih.", color: "#FF3B6B" },
  { slug: "k-pop", name: "K-Pop", description: "Pop energik dan produksi besar.", color: "#00C2FF" },
  { slug: "lo-fi", name: "Lo-Fi", description: "Tekstur lembut buat latar.", color: "#FFF7D6" },
  { slug: "sleep", name: "Sleep", description: "Pelan, minim distraksi.", color: "#111111" },
  { slug: "acoustic", name: "Acoustic", description: "Dekat, hangat, dan sederhana.", color: "#29FF87" },
];

export function moodBySlug(slug: string) {
  return moodItems.find((mood) => mood.slug === slug) ?? null;
}

export function moodQuery(slugOrName: string) {
  return slugOrName.replace(/-/g, " ");
}
