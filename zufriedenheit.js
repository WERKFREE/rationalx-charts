// zufriedenheit.js — Horizontale, animierte "gestapelte" Vergleichsleiste
// Aufruf: drawZufriedenheitStaat({ id: "chart-zufriedenheit", de: 51, oecd: 66 })

function drawZufriedenheitStaat({
  id,
  de = 51,
  oecd = 66,
  duration = 2000 // Gesamtdauer der Hauptanimation
}) {
  const el = document.getElementById(id);
  if (!el) {
    setTimeout(() => drawZufriedenheitStaat({ id, de, oecd, duration }), 60);
    return;
  }

  const mount = d3.select("#" + id);
  mount.selectAll("*").remove();

  // Maße
  const W = Math.max(520, Math.min(el.clientWidth || 720, 1000));
  const H = 200;
  const M = { top: 40, right: 28, bottom: 50, left: 28 };

  const svg = mount.append("svg")
    .attr("width", W)
    .attr("height", H);

  // Skala
  const x = d3.scaleLinear().domain([0, 100]).range([M.left, W - M.right]);

  // Farben
  const cOECD = "#111827";   // Marker
  const cDE   = "#dc2626";   // Deutschland
  const cGap  = "#e5e7eb";   // Lücke innerhalb OECD-Basis
  const cOver = "#16a34a";   // Überschuss, falls DE > OECD

  // Hintergrund-Gitter
  const grid = d3.axisBottom(x)
    .ticks(10)
    .tickSize(-(H - M.top - M.bottom))
    .tickFormat(d => d + "%");

  const gGrid = svg.append("g")
    .attr("transform", `translate(0,${H - M.bottom})`)
    .style("opacity", 0)
    .call(grid);

  gGrid.select(".domain").remove();
  gGrid.selectAll(".tick line").attr("stroke", "#e5e7eb");
  gGrid.selectAll(".tick text").attr("dy", 16).style("fill", "#6b7280");
  gGrid.transition().delay(150).duration(1000).style("opacity", 1);

  // Balken-Geometrie
  const barY = (H - M.top - M.bottom) / 2 + M.top - 14;
  const barH = 28;
  const barR = 14;

  // Basis: OECD-Track
  const base = svg.append("rect")
    .attr("x", x(0))
    .attr("y", barY)
    .attr("width", 0)
    .attr("height", barH)
    .attr("rx", barR)
    .attr("fill", cGap);

  base.transition()
    .delay(200)
    .duration(duration)
    .ease(d3.easeCubicOut)
    .attr("width", Math.max(0, x(oecd) - x(0)));

  // Deutschland-Anteil (rot)
  const deWithin = Math.min(de, oecd);
  const deRect = svg.append("rect")
    .attr("x", x(0))
    .attr("y", barY)
    .attr("width", 0)
    .attr("height", barH)
    .attr("rx", barR)
    .attr("fill", cDE);

  deRect.transition()
    .delay(250 + duration * 0.6)
    .duration(duration * 0.6)
    .ease(d3.easeCubicOut)
    .attr("width", Math.max(0, x(deWithin) - x(0)));

  // Überschuss (falls DE > OECD)
  const overW = Math.max(0, x(de) - x(oecd));
  const overRect = svg.append("rect")
    .attr("x", x(oecd))
    .attr("y", barY)
    .attr("width", 0)
    .attr("height", barH)
    .attr("rx", barR)
    .attr("fill", cOver)
    .style("opacity", de > oecd ? 1 : 0);

  if (de > oecd) {
    overRect.transition()
      .delay(250 + duration * 0.9)
      .duration(duration * 0.6)
      .ease(d3.easeCubicOut)
      .attr("width", overW);
  }

  // OECD-Marker
  const marker = svg.append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", barY - 10)
    .attr("y2", barY + barH + 10)
    .attr("stroke", cOECD)
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4,4");

  marker.transition()
    .delay(200)
    .duration(duration)
    .ease(d3.easeCubicOut)
    .attr("x1", x(oecd))
    .attr("x2", x(oecd));

  // OECD-Label
  const oecdText = svg.append("text")
    .attr("x", x(0))
    .attr("y", barY - 16)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .style("fill", cOECD)
    .style("opacity", 0)
    .text(`OECD ${oecd.toFixed(0)}%`);

  oecdText.transition()
    .delay(200)
    .duration(duration)
    .ease(d3.easeCubicOut)
    .attr("x", x(oecd))
    .style("opacity", 1);

  // DE-Label
  const deLabelAnchorInside = de >= 8 ? "end" : "start";
  const deLabelXTarget = de >= 8 ? x(de) - 6 : x(de) + 6;
  const deLabelColor = de <= oecd ? "#ffffff" : "#0b1f0b";

  const deLabel = svg.append("text")
    .attr("x", x(0) + 6)
    .attr("y", barY + barH / 2 + 4)
    .attr("text-anchor", "start")
    .style("font-size", "12.5px")
    .style("font-weight", "700")
    .style("fill", deLabelColor)
    .style("opacity", 0)
    .text("Deutschland 0%");

  deLabel.transition()
    .delay(250 + duration * 0.6)
    .duration(duration * 0.6)
    .ease(d3.easeCubicOut)
    .style("opacity", 1)
    .attr("x", deLabelXTarget)
    .attr("text-anchor", deLabelAnchorInside)
    .tween("text", () => tweenNumberText(deLabel.node(), 0, de, v => `Deutschland ${v.toFixed(0)}%`));

  // Differenz-Anzeige
  const diff = +(de - oecd).toFixed(1);
  if (Math.abs(diff) >= 0.1) {
    const x0 = x(Math.min(de, oecd));
    const x1 = x(Math.max(de, oecd));
    const yAnn = barY + barH + 30;

    const diffLine = svg.append("line")
      .attr("x1", x0)
      .attr("x2", x0)
      .attr("y1", yAnn)
      .attr("y2", yAnn)
      .attr("stroke", "#9ca3af")
      .attr("stroke-width", 1.5);

    diffLine.transition()
      .delay(200 + duration)
      .duration(duration * 0.7)
      .ease(d3.easeCubicOut)
      .attr("x2", x1);

    const diffText = svg.append("text")
      .attr("x", (x0 + x1) / 2)
      .attr("y", yAnn - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#374151")
      .style("opacity", 0);

    diffText.transition()
      .delay(300 + duration + 250)
      .duration(duration * 1.0)
      .style("opacity", 1)
      .tween("text", () => tweenNumberText(diffText.node(), 0, diff, v => 
        (v < 0 ? `−${Math.abs(v).toFixed(1)}%-Punkte` : `+${v.toFixed(1)}%-Punkte`)
      ));
  }

  // Helper
  function tweenNumberText(node, from, to, fmt) {
    const i = d3.interpolateNumber(from, to);
    return t => { node.textContent = fmt(i(t)); };
  }
}
