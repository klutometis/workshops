import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const IMG = process.argv[2] || "/home/danenberg/prg/avatar/app/public/spark.png";
const OUT = "/home/danenberg/prg/avatar/app/public/spark-idle.mp4";

const prompt =
  "A friendly glowing four-pointed star character with big kind eyes, gently bobbing and softly blinking, a warm welcoming smile, subtle floating idle breathing motion, polished 3D cartoon style, plain soft off-white studio background, static locked-off camera, calm and seamless. No text, no people.";

console.log("→ Veo 3.1 image-to-video starting…");
let op = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt,
  image: { imageBytes: fs.readFileSync(IMG).toString("base64"), mimeType: "image/png" },
  config: { aspectRatio: "9:16", resolution: "720p" },
});
console.log("  op:", op.name);

const t0 = Date.now();
while (!op.done) {
  await new Promise((r) => setTimeout(r, 10000));
  op = await ai.operations.getVideosOperation({ operation: op });
  console.log(`  …polling (${Math.round((Date.now() - t0) / 1000)}s) done=${op.done}`);
}

if (op.error) { console.error("✗ error:", JSON.stringify(op.error)); process.exit(1); }
const vid = op.response?.generatedVideos?.[0]?.video;
if (!vid) { console.error("✗ no video in response:", JSON.stringify(op.response)); process.exit(1); }

await ai.files.download({ file: vid, downloadPath: OUT });
console.log("✓ saved:", OUT);
