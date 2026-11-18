/**
 * charts.js - dependency free SVG charts.
 *   barChart(container, { labels, series: [{ name, color, values }] })
 *   donutChart(container, { items: [{ label, value, color }], centerValue, centerLabel })
 * Both draw with a viewBox so they scale to the card width.
 */
import { shortNumber, money } from "../utils/format.js";
import { esc } from "../utils/dom.js";

const NS = "http://www.w3.org/2000/svg";

/* ---------- Tooltip shared by all charts ---------- */

let tip;
function showTip(evt, html) {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "chart-tooltip";
    document.body.appendChild(tip);
  }
  tip.innerHTML = html;
  tip.style.display = "block";
  tip.style.left = `${evt.clientX + 12}px`;
  tip.style.top = `${evt.clientY - 32}px`;
}
function hideTip() {
  if (tip) tip.style.display = "none";
}

/** Round the axis maximum up to a tidy number (e.g. 83,400 -> 100,000). */
function niceMax(value) {
  if (value <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const step = steps.find((s) => s * exp >= value) || 10;
  return step * exp;
}

/* ---------- Grouped bar chart ---------- */

export function barChart(container, options) {
  draw(container, options);
  // redraw when the card changes width so text stays readable
  if (!container._observer) {
    let last = container.clientWidth;
    container._observer = new ResizeObserver(() => {
      if (Math.abs(container.clientWidth - last) > 20) {
        last = container.clientWidth;
        draw(container, container._options);
      }
    });
    container._observer.observe(container);
  }
}

function draw(container, { labels, series, height = 240 }) {
  container._options = { labels, series, height };
  const width = Math.max(container.clientWidth || 600, 260);
  const pad = { top: 10, right: 8, bottom: 28, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const ticks = 4;

  const groupW = innerW / Math.max(labels.length, 1);
  const barW = Math.min(18, (groupW * 0.5) / series.length);
  const gap = 6;

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">`;

  for (let i = 0; i <= ticks; i++) {
    const y = pad.top + innerH - (innerH * i) / ticks;
    svg += `<line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}"/>`;
    svg += `<text class="axis-label" x="${pad.left - 8}" y="${y + 3}" text-anchor="end">${shortNumber((max * i) / ticks)}</text>`;
  }

  labels.forEach((label, gi) => {
    const groupX = pad.left + groupW * gi + groupW / 2;
    const totalW = series.length * barW + (series.length - 1) * gap;
    series.forEach((s, si) => {
      const v = s.values[gi] || 0;
      const h = (v / max) * innerH;
      const x = groupX - totalW / 2 + si * (barW + gap);
      const y = pad.top + innerH - h;
      svg += `<rect class="bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 0)}" rx="3" fill="${s.color}"
        data-tip="${esc(`${label} · ${s.name}: ${money(v)}`)}"/>`;
    });
    svg += `<text class="axis-label" x="${groupX}" y="${height - 8}" text-anchor="middle">${esc(label)}</text>`;
  });

  svg += "</svg>";

  const legend = `<div class="legend">${series
    .map((s) => `<span class="legend-item"><span class="swatch" style="background:${s.color}"></span>${esc(s.name)}</span>`)
    .join("")}</div>`;

  container.classList.add("chart");
  container.innerHTML = svg + legend;
  bindTips(container);
}

/* ---------- Donut chart ---------- */

export function donutChart(container, { items, centerValue = "", centerLabel = "", size = 170, stroke = 26 }) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Donut chart">`;
  svg += `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#edf1f5" stroke-width="${stroke}"/>`;

  if (total > 0) {
    items.forEach((item) => {
      const len = (item.value / total) * c;
      // a 2px gap between slices, like the design
      const visible = Math.max(len - 2, 0);
      svg += `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${item.color}" stroke-width="${stroke}"
        stroke-dasharray="${visible} ${c - visible}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${cx} ${cx})"
        data-tip="${esc(`${item.label}: ${money(item.value)} (${((item.value / total) * 100).toFixed(0)}%)`)}"/>`;
      offset += len;
    });
  }

  svg += `<text x="${cx}" y="${cx - 2}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${esc(centerValue)}</text>`;
  svg += `<text x="${cx}" y="${cx + 15}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${esc(centerLabel)}</text>`;
  svg += "</svg>";

  container.innerHTML = svg;
  container.style.flexShrink = "0";
  bindTips(container);
}

function bindTips(container) {
  container.querySelectorAll("[data-tip]").forEach((node) => {
    node.addEventListener("mousemove", (e) => showTip(e, esc(node.dataset.tip)));
    node.addEventListener("mouseleave", hideTip);
  });
}
