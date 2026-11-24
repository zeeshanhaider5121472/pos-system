export const money = (n: number, cur = "") =>
  `${cur ? cur + " " : ""}${Math.round(n).toLocaleString("en-US")}`;
export const dayStart = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const dayEnd = (d = new Date()) => dayStart(d) + 86_400_000 - 1;
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function download(
  filename: string,
  content: string,
  type = "text/plain",
) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
