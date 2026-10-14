export const artworkPaths = {
  cover: "/assets/scenes/bath-cover-v2.webp",
  stage: "/assets/scenes/bath-stage-v2.webp",
  frog: "/assets/character/milk-frog-atlas.webp",
  extra: "/assets/character/milk-frog-extra-v2.webp",
  props: "/assets/props/bath-props-v1.webp",
  garden: "/assets/props/garden-props-v1.webp",
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
