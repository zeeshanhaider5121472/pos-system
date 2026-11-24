const H = () => ({
  Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
});
const B = () => process.env.UPSTASH_REDIS_REST_URL!;

export async function kvGet<T = any>(key: string): Promise<T | null> {
  const j = await (
    await fetch(`${B()}/get/${encodeURIComponent(key)}`, {
      headers: H(),
      cache: "no-store",
    })
  ).json();
  return j.result ? JSON.parse(j.result) : null;
}
export async function kvSet(key: string, value: unknown) {
  await fetch(`${B()}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: H(),
    body: JSON.stringify(value),
  });
}
export async function kvIncr(key: string): Promise<number> {
  const j = await (
    await fetch(`${B()}/incr/${encodeURIComponent(key)}`, {
      headers: H(),
      cache: "no-store",
    })
  ).json();
  const n = Number(j.result);
  if (n === 1)
    await fetch(`${B()}/expire/${encodeURIComponent(key)}/3600`, {
      headers: H(),
    });
  return n;
}
