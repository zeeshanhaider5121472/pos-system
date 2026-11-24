"use client";
// One-click PDF export for report tables — mirrors the CSV export.
// The table is built offscreen as real HTML (so Urdu/RTL text looks exactly
// like it does in the app), rasterised with html2canvas-pro and placed into
// a paginated A4 PDF with jsPDF. Works fully offline; the libraries are
// dynamically imported only when the button is first clicked.
import type { jsPDF as JsPDFType } from "jspdf";

export async function exportTablePdf(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
  rtl?: boolean;
}) {
  const W = 900; // offscreen render width in px
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const align = opts.rtl ? "right" : "left";

  const wrap = document.createElement("div");
  wrap.dir = opts.rtl ? "rtl" : "ltr";
  wrap.style.cssText =
    "position:fixed;left:-10000px;top:0;" +
    `width:${W}px;background:#ffffff;color:#0f172a;` +
    'font-family:"Segoe UI",-apple-system,"Noto Naskh Arabic",Tahoma,sans-serif;';

  const head = `<div style="margin:0 0 14px">
    <div style="font-size:20px;font-weight:700">${esc(opts.title)}</div>
    ${
      opts.subtitle
        ? `<div style="font-size:12px;color:#64748b;margin-top:3px">${esc(opts.subtitle)}</div>`
        : ""
    }
  </div>`;

  const th = opts.columns
    .map(
      (c) =>
        `<th style="background:#0f172a;color:#ffffff;padding:8px 10px;font-size:12px;text-align:${align};border:1px solid #0f172a">${esc(c)}</th>`,
    )
    .join("");

  const body = opts.rows.length
    ? opts.rows
        .map(
          (r, i) =>
            `<tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"}">` +
            r
              .map(
                (c) =>
                  `<td style="padding:7px 10px;font-size:12px;text-align:${align};border:1px solid #e2e8f0">${esc(
                    String(c),
                  )}</td>`,
              )
              .join("") +
            "</tr>",
        )
        .join("")
    : `<tr><td colspan="${opts.columns.length}" style="padding:14px 10px;font-size:12px;text-align:center;color:#94a3b8;border:1px solid #e2e8f0">—</td></tr>`;

  wrap.innerHTML =
    head +
    `<table style="border-collapse:collapse;width:100%"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;

  document.body.appendChild(wrap);
  try {
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);
    const canvas = await html2canvas.default(wrap, {
      scale: 2,
      backgroundColor: "#ffffff",
    });

    const pdf: JsPDFType = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });
    const M = 10; // page margin in mm
    const imgW = 210 - M * 2; // A4 width minus margins
    const pxPerMm = canvas.width / imgW;
    const sliceH = Math.floor((297 - M * 2) * pxPerMm);

    let y = 0;
    let first = true;
    while (y < canvas.height) {
      const h = Math.min(sliceH, canvas.height - y);
      const c = document.createElement("canvas");
      c.width = canvas.width;
      c.height = h;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      }
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(
        c.toDataURL("image/jpeg", 0.92),
        "JPEG",
        M,
        M,
        imgW,
        h / pxPerMm,
      );
      y += h;
    }
    pdf.save(opts.filename);
  } finally {
    wrap.remove();
  }
}
