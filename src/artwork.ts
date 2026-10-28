import { loadImage } from "./loading.ts";
import type { Level } from "./game/levels.ts";
export const artworkPaths = {
  hauntedCover: "/assets/scenes/haunted-cover-v1.webp",
  cover: "/assets/scenes/bath-cover-v2.webp",
  stage: "/assets/scenes/bath-stage-v2.webp",
  workshop: "/assets/scenes/workshop-stage-v1.webp",
  hauntedBath: "/assets/scenes/haunted-bath-v1.webp",
  hauntedCorridor: "/assets/scenes/haunted-corridor-v1.webp",
  hauntedMachine: "/assets/scenes/haunted-machine-v1.webp",
  hauntedLaundry: "/assets/scenes/haunted-laundry-v1.webp",
  hauntedFrog: "/assets/character/haunted-frog-v1.webp",
  halloweenBath: "/assets/scenes/halloween-bath-v1.png",
  infernalBath: "/assets/scenes/infernal-bath-v1.png",
  infernalFrog: "/assets/character/infernal-frog-v1.png",
  pumpkin: "/assets/props/pumpkin-v1.webp",
  frog: "/assets/character/milk-frog-atlas.webp",
  extra: "/assets/character/milk-frog-extra-v2.webp",
  props: "/assets/props/bath-props-v1.webp",
  garden: "/assets/props/garden-props-v1.webp",
  tub: "/assets/props/bathtub-v1.webp",
};
export type Artwork = { [K in keyof typeof artworkPaths]: HTMLImageElement };
const images = new Map<keyof Artwork, HTMLImageElement>();
const pending = new Map<keyof Artwork, Promise<HTMLImageElement>>();
// The renderer reads only keys prepared for its level; never silently draw a substitute.
const artwork = Object.defineProperties({}, Object.fromEntries(Object.keys(artworkPaths).map(name => [name, { enumerable: true, get() {
  const image = images.get(name as keyof Artwork); if (!image) throw new Error(`贴图尚未准备：${name}`); return image;
} }]))) as Artwork;
export function levelArtworkKeys(level: Level): (keyof Artwork)[] {
  return [...new Set<keyof Artwork>(["props", "garden", "tub", level.scene && level.scene !== "bath" ? level.scene : "stage",
    ...(level.mode ? ["hauntedFrog", "pumpkin"] as const : ["frog", "extra"] as const),
    ...(level.mode === "infernal" ? ["infernalFrog"] as const : [])])];
}
export async function loadArtwork(
  onProgress: (done: number, total: number) => void,
  keys: readonly (keyof Artwork)[] = Object.keys(artworkPaths) as (keyof Artwork)[],
): Promise<Artwork> {
  let done = 0;
  await Promise.all(keys.map(async name => {
    if (!images.has(name)) {
      let task = pending.get(name);
      if (!task) { task = loadImage(artworkPaths[name]).then(image => { images.set(name, image); return image; }).finally(() => pending.delete(name)); pending.set(name, task); }
      await task;
    }
    onProgress(++done, keys.length);
  }));
  return artwork;
}
