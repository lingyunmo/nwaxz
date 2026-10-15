export const artworkPaths = {
  cover: "/assets/scenes/bath-cover-v2.webp",
  stage: "/assets/scenes/bath-stage-v2.webp",
  workshop: "/assets/scenes/workshop-stage-v1.webp",
  hauntedBath: "/assets/scenes/haunted-bath-v1.webp",
  hauntedCorridor: "/assets/scenes/haunted-corridor-v1.webp",
  hauntedMachine: "/assets/scenes/haunted-machine-v1.webp",
  hauntedFrog: "/assets/character/haunted-frog-v1.webp",
  pumpkin: "/assets/props/pumpkin-v1.webp",
  frog: "/assets/character/milk-frog-atlas.webp",
  extra: "/assets/character/milk-frog-extra-v2.webp",
  props: "/assets/props/bath-props-v1.webp",
  garden: "/assets/props/garden-props-v1.webp",
  tub: "/assets/props/bathtub-v1.webp",
};
export type Artwork = { [K in keyof typeof artworkPaths]: HTMLImageElement };
export async function loadArtwork(
  onProgress: (done: number, total: number) => void,
): Promise<Artwork> {
  const entries = Object.entries(artworkPaths);
  let done = 0;
  const images = await Promise.all(
    entries.map(async ([name, url]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      onProgress(++done, entries.length);
      return [name, image] as const;
    }),
  );
  return Object.fromEntries(images) as Artwork;
}
