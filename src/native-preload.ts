export const isNativePainting = (pathname: string) => /\/assets\/versus\/.+\.png$/.test(pathname) || /^\/assets\/(?:scenes\/(?:halloween|infernal)-(?:bath|cover)|character\/infernal-frog)-v1\.png$/.test(pathname);
/** Assemble native images before caching: no resizing or image encoding occurs here. */
export async function fetchNativeImage(url: string, bytes: number, integrity: string, onProgress: (bytes: number) => void, fetcher: typeof fetch = fetch): Promise<Response> {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 8 * 1024 * 1024 || !/^sha256-[A-Za-z0-9+/]{43}=$/.test(integrity)) throw new Error("原画清单无效");
  const chunkSize = 256 * 1024, buffer = new Uint8Array(bytes);
  let received = 0;
  const request = async (start: number, end: number) => {
    for (let attempt = 0; ; attempt++) {
      try { return await fetcher(url, { credentials: "same-origin", cache: "no-store", headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(20_000) }); }
      catch (error) { if (attempt >= 1) throw error; }
    }
  };
  const firstEnd = Math.min(bytes, chunkSize) - 1;
  const first = await request(0, firstEnd);
  const headers = new Headers(first.headers);
  if (!/^image\/png(?:;|$)/i.test(headers.get("content-type") ?? "")) throw new Error("原画响应格式无效");
  const readPart = async (response: Response, start: number, end: number) => {
    if (response.status !== 206 || response.headers.get("content-range") !== `bytes ${start}-${end}/${bytes}`) throw new Error("原画分段范围无效");
    const part = new Uint8Array(await response.arrayBuffer());
    if (part.byteLength !== end - start + 1) throw new Error("原画分段长度无效");
    buffer.set(part, start); received += part.byteLength; onProgress(received);
  };
  if (first.status === 200) {
    // Servers that ignore Range may still return the complete, verified original.
    const whole = new Uint8Array(await first.arrayBuffer());
    if (whole.byteLength !== bytes) throw new Error("原画长度无效");
    buffer.set(whole); onProgress(bytes);
  } else {
    await readPart(first, 0, firstEnd);
    let next = chunkSize;
    await Promise.all(Array.from({ length: 2 }, async () => {
      while (next < bytes) { const start = next; next += chunkSize; const end = Math.min(bytes - 1, start + chunkSize - 1); await readPart(await request(start, end), start, end); }
    }));
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  if (`sha256-${btoa(String.fromCharCode(...digest))}` !== integrity) throw new Error("原画完整性校验失败");
  headers.delete("content-range"); headers.delete("content-encoding"); headers.set("content-length", String(bytes));
  return new Response(buffer, { status: 200, headers });
}
