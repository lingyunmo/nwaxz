const paths = {
  pause: '<path d="M8 5v14M16 5v14"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  key: '<circle cx="8" cy="8" r="4"/><path d="m11 11 9 9m-4-4 3-3m-6 0 3-3"/>',
  handwheel: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6"/><path d="M12 5V2m0 20v-3M5 12H2m20 0h-3M7 7 5 5m14 14-2-2m0-10 2-2M5 19l2-2"/>',
  fuse: '<path d="M7 5h10v14H7Zm0 3H4v8h3m10-8h3v8h-3m-7-4h4"/>',
  cutters: '<circle cx="7" cy="18" r="3"/><circle cx="17" cy="18" r="3"/><path d="m9 16 8-13m-2 13L7 3m5 7v3"/>',
  light: '<path d="m4 10 6-6 5 5-6 6Zm6-6 1-3 7 7-3 1m-7 5 7 7 6-6-7-7M2 2l2 2m14-2-1 3M2 18l3-1"/>',
  crouch: '<circle cx="13" cy="4" r="2"/><path d="m12 8-3 5 7 1 2 7M9 13l-3 5H2m9-8 4 1 4-3"/>',
  run: '<circle cx="15" cy="3" r="2"/><path d="m13 7-5 3-4-2m9-1 4 5h4m-9-3-2 7 5 5m-5-5-5 5H1"/>',
  stone: '<path d="m5 7 9-3 6 6-1 8-8 3-8-5Zm0 0 7 5 8-2m-8 2-1 9"/>',
  heart: '<path d="M12 21 3 12C-2 5 7-1 12 6c5-7 14-1 9 6Z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  hand: '<path d="M6 12V7a2 2 0 0 1 4 0v5-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v7-3a2 2 0 0 1 4 0v5c0 5-4 7-8 7h-1c-3 0-5-2-7-4l-4-5c-1-2 1-4 3-2l3 3"/>',
};
export function icon(name: keyof typeof paths) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
