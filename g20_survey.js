// helpers
function makeSvg(sel, w = 950, h = 600, m = { top: 30, right: 120, bottom: 40, left: 70 }) {
  const svg = d3.select("#" + sel).append("svg").attr("width", w).attr("height", h);
  return { svg, w, h, m, innerW: w - m.left - m.right, innerH: h - m.top - m.bottom };
}

/**
 * drawG20Survey — "Society is broken" (% Agree)
 * CSV: Country,Year_2016,Year_2019,Year_2021,Year_2023,Year_2025 (Zahlen, ohne %)
 * Options: id, dataFile, highlight="Germany"
 * Optional: #year-overlay im DOM wird automatisch aktualisiert, wenn vorhanden.
 */
function drawG20Survey({ id, dataFile, highlight = "Germany" }) {
  const { svg, innerW, innerH, m } = makeSvg(id);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  // Tooltip
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("padding", "8px 10px")
    .style("background", "rgba(20,20,20,0.92)")
    .style("color", "#fff")
    .style("border-radius", "6px")
    .style("font-size", "12px")
    .style("opacity", 0);

  const yearOverlaySel = d3.select("#year-overlay"); // optional

  // Länder-Set (inkl. Synonyme)
  const G20_CANON = [
    "Argentina","Australia","Brazil","Canada","China","France","Germany",
    "India","Indonesia","Italy","Japan","Mexico","Russian Federation","Russia","Saudi Arabia",
    "South Africa","Korea, Rep.","South Korea","Turkey","Türkiye","United Kingdom","United States","European Union"
  ];

  const ALIASES = {
    "Korea, Rep.": ["South Korea","Korea, Rep."],
    "South Korea": ["South Korea","Korea, Rep."],
    "Turkey": ["Türkiye","Turkey"],
    "Türkiye": ["Türkiye","Turkey"],
    "Russian Federation": ["Russian Federation","Russia"],
    "Russia": ["Russian Federation","Russia"],
    "United Kingdom": ["United Kingdom","Great Britain","UK"],
    "United States": ["United States","USA","U.S."],
    "European Union": ["European Union","EU"]
  };

  const YEARS = [2016, 2019, 2021, 2023, 2025];

  d3.csv(dataFile).then(raw => {
    const byCountry = new Map(raw.map(d => [d.Country, d]));
    const rowFor = (name) => {
      const aliases = ALIASES[name] || [name];
      for (const a of aliases) { const r = byCountry.get(a); if (r) return r; }
      return null;
    };

    // Serien bauen
    const seriesAll = [];
    G20_CANON.forEach(name => {
      const row = rowFor(name);
      if (!row) return;
      const values = YEARS.map(y => {
        const v = parseFloat(row[`Year_${y}`]);
        return { year: y, value: Number.isFinite(v) ? v : null };
      });
      if (values.some(d => d.value !== null)) seriesAll.push({ country: name, values });
    });

    // Skalen (Y fix 50–80)
    const x = d3.scaleLinear().domain(d3.extent(YEARS)).range([0, innerW]);
    const y = d3.scaleLinear().domain([30, 80]).range([innerH, 0]);

    // Achsen
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(YEARS).tickFormat(d3.format("d")));

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + "%"));

    // Gridlines
    g.append("g").attr("class", "grid")
      .selectAll("line")
      .data(y.ticks(6))
      .join("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#eee");

    // Liniengenerator
    const line = d3.line()
      .defined(d => d.value !== null)
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    // Hintergrund: alle außer Highlight
    const backgroundSeries = seriesAll.filter(s => s.country !== highlight);
    const bgPaths = g.selectAll(".country-line.bg")
      .data(backgroundSeries)
      .join("path")
      .attr("class", "country-line bg")
      .attr("fill", "none")
      .attr("stroke", "#bdbdbd")
      .attr("stroke-width", 1.3)
      .attr("opacity", 0.9)
      .attr("d", d => line(d.values));

    // EU (falls vorhanden) separat
    const euSeries = seriesAll.find(s => s.country === "European Union");
    let euPath = null;
    if (euSeries) {
      euPath = g.append("path")
        .datum(euSeries.values)
        .attr("class", "country-line eu")
        .attr("fill", "none")
        .attr("stroke", "#888")
        .attr("stroke-width", 2)
        .attr("opacity", 0.95)
        .attr("d", line);
    }

    // Germany (Highlight) – robust, falls nicht vorhanden
    const germanySeries = seriesAll.find(s => s.country === highlight);
    if (!germanySeries) {
      console.warn(`Highlight '${highlight}' nicht in den Daten gefunden.`);
    }
    const germanyPath = germanySeries ? g.append("path")
      .datum(germanySeries.values)
      .attr("class", "country-line highlight")
      .attr("fill", "none")
      .attr("stroke", "var(--highlight)")
      .attr("stroke-width", 3)
      .attr("opacity", 1)
      .attr("d", line) : null;

    // Dots & Label für Germany (Label ist jetzt die ganze Zeit sichtbar)
    const germanyDot = germanySeries ? g.append("circle")
      .attr("r", 6)
      .attr("fill", "var(--highlight)")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2) : null;

    const germanyLabel = germanySeries ? g.append("text")
      .attr("class", "chart-label")
      .style("font-weight", "600")
      .style("font-size", "13px")
      .style("fill", "var(--highlight)")
      .style("opacity", 1) // sofort sichtbar
      .text("Germany") : null;

    // Stroke-dash vorbereiten
    function prepDash(pathSel) {
      const L = pathSel.node().getTotalLength();
      pathSel.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L);
      return L;
    }
    const bgLens = [];
    bgPaths.each(function(){ bgLens.push(prepDash(d3.select(this))); });
    const euLen  = euPath ? prepDash(euPath) : 0;
    const deLen  = germanyPath ? prepDash(germanyPath) : 0;

    // Startpos Dots & Label
    if (germanyPath && germanyDot) {
      const deStart = germanyPath.node().getPointAtLength(0);
      germanyDot.attr("cx", deStart.x).attr("cy", deStart.y);
      if (germanyLabel) {
        germanyLabel.attr("x", deStart.x + 10).attr("y", deStart.y);
      }
    }

    // Animation
    const T = 8000, ease = d3.easeCubicInOut;
    const YEARS_LEN = YEARS.length;

    // Für Endlabels sammeln (Nicht-Highlight)
    const endLabels = [];
    let finished = 0;
    const totalToWaitFor = backgroundSeries.length + (euPath ? 1 : 0) + (germanyPath ? 1 : 0);

    bgPaths.transition().duration(T).ease(ease)
      .attr("stroke-dashoffset", 0)
      .on("end", function(d) {
        const last = lastDefined(d.values);
        if (last) endLabels.push({ country: d.country, y: y(last.value) });
        checkAllFinished();
      });

    if (euPath) {
      euPath.transition().duration(T).ease(ease)
        .attr("stroke-dashoffset", 0)
        .on("end", () => checkAllFinished());
    }

    if (germanyPath) {
      germanyPath.transition().duration(T).ease(ease)
        .attr("stroke-dashoffset", 0)
        .tween("follow-germany", function() {
          const node = this, L = deLen;
          return function(t) {
            const p = node.getPointAtLength(t * L);
            if (germanyDot) germanyDot.attr("cx", p.x).attr("cy", p.y);
            // Label folgt dem Dot mit Offset
            if (germanyLabel) germanyLabel.attr("x", p.x + 10).attr("y", p.y);
            const idx = Math.round(t * (YEARS_LEN - 1));
            if (!yearOverlaySel.empty()) yearOverlaySel.text(YEARS[idx]);
          };
        })
        .on("end", () => checkAllFinished());
    }

    // Wenn alles fertig: Labels platzieren (ohne Germany)
    function checkAllFinished() {
      finished++;
      if (finished < totalToWaitFor) return;

      // Endlabels für alle (ohne Germany) rechts platzieren
      const placed = endLabels
        .map(l => ({ ...l, x: innerW + 10, origY: l.y, color: "#888" }))
        .sort((a, b) => a.y - b.y);

      const minGap = 14;
      for (let i = 1; i < placed.length; i++) {
        if (placed[i].y - placed[i - 1].y < minGap) {
          placed[i].y = placed[i - 1].y + minGap;
        }
      }

      placed.forEach(l => {
        if (Math.abs(l.y - l.origY) > 2) {
          g.append("line")
            .attr("x1", innerW).attr("y1", l.origY)
            .attr("x2", l.x).attr("y2", l.y)
            .attr("stroke", "#aaa").attr("stroke-width", 0.7);
        }
        g.append("text")
          .attr("class", "chart-label")
          .attr("x", l.x + 2).attr("y", l.y)
          .attr("dy", "0.35em")
          .style("fill", l.color)
          .style("font-size", "12px")
          .text(l.country)
          .style("opacity", 0)
          .transition().duration(500).style("opacity", 1);
      });
    }

    // Tooltip
    g.selectAll(".country-line")
      .on("mouseover", (event, d) => {
        const last = lastDefined(d.values);
        if (!last) return;
        tooltip.style("opacity", 1)
          .html(`<b>${d.country}</b><br>${last.value.toFixed(1)}% agree (${last.year})`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Legende entfernt (nicht mehr benötigt)

    // Helper
    function lastDefined(arr) {
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i] && arr[i].value !== null) return arr[i];
      return null;
    }
  });
}