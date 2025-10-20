// productivity.js — Productivity Trajectories im GDP-Design (G20-Peers + Germany)
// D3 v7 — Mit gleichmäßiger Linienanimation

function makeSvg(sel, w = 950, h = 600, m = { top: 30, right: 120, bottom: 40, left: 70 }) {
  const svg = d3.select("#" + sel).append("svg").attr("width", w).attr("height", h);
  return { svg, w, h, m, innerW: w - m.left - m.right, innerH: h - m.top - m.bottom };
}

function drawBubbleChart({
  id,
  dataFile,
  startYear = 1950,
  endYear = 2024,
  yMin = 1200,
  yMax = 2800,
  highlight = "Germany"
}) {
  const { svg, innerW, innerH, m } = makeSvg(id);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  // Tooltip (nutzt .tooltip aus deiner style.css)
  const tooltip = d3.select("body").selectAll("div.tooltip").data([null]).join("div").attr("class", "tooltip");

  // Peers: G20 aus dem GDP-Chart übernehmen (siehe window.__G20 in gdppercapita.js)
  const peersWanted = new Set([...(window.__G20 || []), highlight]);

  d3.csv(dataFile, d3.autoType).then(rows => {
    if (!rows?.length) {
      console.error("CSV leer:", dataFile);
      return;
    }

    // Long-Form + Zeitraumfilter + gültige Werte
    const long = rows
      .map(d => ({
        country: d.Entity,
        year: +d.Year,
        hours: +d["Average working hours per worker"],
        prod: +d["Productivity: output per hour worked"]
      }))
      .filter(
        d =>
          d.country &&
          peersWanted.has(d.country) &&
          Number.isFinite(d.year) &&
          d.year >= startYear &&
          d.year <= endYear &&
          Number.isFinite(d.hours) &&
          Number.isFinite(d.prod)
      );

    // Gruppieren & chronologisch sortieren
    const series = d3.group(long, d => d.country);
    series.forEach(vals => vals.sort((a, b) => d3.ascending(a.year, b.year)));

    // Nur Länder mit mind. 2 Punkten behalten (sonst kein Verlauf)
    const countries = Array.from(series.keys()).filter(k => (series.get(k) || []).length >= 2);

    // Skalen (linear – wie GDP-Chart)
    const xMinRaw = d3.min(countries.flatMap(k => series.get(k).map(d => d.prod)));
    const xMaxRaw = d3.max(countries.flatMap(k => series.get(k).map(d => d.prod)));
    const xDomain = [Math.max(0, xMinRaw * 0.95), xMaxRaw * 1.05];
    const x = d3.scaleLinear().domain(xDomain).range([0, innerW]);

    const y = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

    // Clamp-Helper (schneidet außerhalb der Range)
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const clampX = v => clamp(v, xDomain[0], xDomain[1]);
    const clampY = v => clamp(v, yMin, yMax);

    // Achsen (nutzen .axis aus CSS)
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => "$" + d3.format(",")(d)));

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => d3.format(",")(d) + " h"));

    // Liniengenerator (Monotone wie GDP) + Clamping in den Accessors
    const line = d3
      .line()
      .defined(d => Number.isFinite(d.prod) && Number.isFinite(d.hours))
      .x(d => x(clampX(d.prod)))
      .y(d => y(clampY(d.hours)))
      .curve(d3.curveMonotoneX);

    // Animationsdauer
    const T = 12000; // 12s für alle

    // Jahresanzeige (große Zahl oben rechts)
    const yearDisplay = g
      .append("text")
      .attr("class", "year-display")
      .attr("x", innerW - 10)
      .attr("y", 40)
      .attr("text-anchor", "end")
      .style("font-size", "48px")
      .style("font-weight", "700")
      .style("fill", "#ddd")
      .style("opacity", 0.6)
      .text(startYear);

    // Zeichnen pro Land
    countries.forEach(country => {
      const vals = series.get(country);
      const isHL = country === highlight;

      const cls = isHL ? "chart-line chart-line--highlight" : "chart-line";

      // Pfad zeichnen mit Dasharray-Maskierung
      const path = g
        .append("path")
        .datum(vals)
        .attr("class", cls)
        .attr("d", line);

      const total = path.node().getTotalLength();

      // Pfad initial komplett verstecken
      path
        .attr("stroke-dasharray", `${total} ${total}`)
        .attr("stroke-dashoffset", total);

      // Bewegter Dot (exakt auf der Linie)
      const dot = g
        .append("circle")
        .attr("r", isHL ? 5 : 3)
        .attr("fill", isHL ? "var(--highlight)" : "#999");

      // Live-Label neben dem Punkt – für alle Länder
      const liveLabel = g
        .append("text")
        .attr("class", "chart-label")
        .attr("text-anchor", "start")
        .style("font-weight", isHL ? "600" : "400")
        .style("fill", isHL ? "var(--highlight)" : "#666")
        .style("font-size", isHL ? "12px" : "11px")
        .text(country);

      // Startposition exakt am Pfadanfang
      const p0 = path.node().getPointAtLength(0);
      dot.attr("cx", p0.x).attr("cy", p0.y);
      liveLabel.attr("x", p0.x + 8).attr("y", p0.y);

      // Gleichmäßige Animation über die Pfadlänge
      const startTime = performance.now();
      
      function animate() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / T, 1); // 0 bis 1
        
        // Aktuelles Jahr berechnen und anzeigen
        const currentYear = Math.round(startYear + t * (endYear - startYear));
        yearDisplay.text(currentYear);
        
        // Aktuelle Position auf dem Pfad
        const currentLength = t * total;
        const p = path.node().getPointAtLength(currentLength);
        
        // Dot und Label bewegen
        dot.attr("cx", p.x).attr("cy", p.y);
        liveLabel.attr("x", p.x + 8).attr("y", p.y);
        
        // Pfad aufdecken
        path.attr("stroke-dashoffset", total - currentLength);
        
        // Weiter animieren oder beenden
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Final auf letzten (geclamp-ten) Punkt parken
          const last = vals[vals.length - 1];
          const X = x(clampX(last.prod));
          const Y = y(clampY(last.hours));
          dot.attr("cx", X).attr("cy", Y);
          liveLabel.attr("x", X + 8).attr("y", Y);
        }
      }
      
      // Animation starten
      requestAnimationFrame(animate);

      // Tooltip am Pfad
      path
        .on("mouseover", (event) => {
          const last = vals[vals.length - 1];
          tooltip
            .style("opacity", 1)
            .html(
              `<b>${country}</b><br>` +
                `Letzter Punkt: $${d3.format(",")(clampX(last.prod))} | ${d3.format(",")(clampY(last.hours))} h`
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 20 + "px");
        })
        .on("mousemove", (event) => {
          tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY - 20 + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
    });

  }).catch(err => console.error("Fehler beim Laden/Parsen der CSV:", err));
}