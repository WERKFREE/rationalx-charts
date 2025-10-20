// investitionsquote.js — Animierter Scatter TGGE (% BIP) vs. GGFC (% BIP)
// X: TGGE  (Total general government expenditure, % of GDP)  → "Geopolitical entity (reporting)"
// Y: GGFC  (General government gross fixed capital formation, % of GDP) → "geo"

function drawInvestScatter({
  id,
  spendFile,              // TGGE.csv
  investFile,             // GGFC.csv
  filterAggregates = true,
  intervalMs = 1200,      // Dauer je Frame
  startYear = 1980        // optional: Animation erst ab diesem Jahr
}) {
  const host = document.getElementById(id);
  if (!host) { setTimeout(() => drawInvestScatter({ id, spendFile, investFile, filterAggregates, intervalMs, startYear }), 50); return; }

  const mount = d3.select("#" + id);
  mount.selectAll("*").remove();

  const W = 760, H = 500, M = { top: 60, right: 40, bottom: 70, left: 80 };
  const svg = mount.append("svg").attr("width", W).attr("height", H);

  const load = p => d3.csv(p, d3.autoType);
  const T = s => (s == null ? "" : String(s)).trim();

  // Zahl robust parsen
  const parseNumber = v => {
    if (v == null || v === "") return null;
    const n = +String(v).replace("%","").replace(",",".").trim();
    return Number.isFinite(n) ? n : null;
  };

  // OBS_VALUE bevorzugen, ansonsten "Observation value"
  const getObsValue = r => {
    let v = r.OBS_VALUE;
    if (v == null || v === "") v = r["OBS_VALUE "];
    if (v == null || v === "") v = r["Observation value"];
    if (v == null || v === "") v = r["Observation value "];
    return parseNumber(v);
  };

  const isAggregate = name => {
    const n = name.toLowerCase();
    return n.includes("euro area") || n.includes("european union") || n.includes("ea19") || n.includes("ea20") || n.includes("eu27");
  };

  Promise.all([load(investFile), load(spendFile)]).then(([ggfcRows, tggeRows]) => {
    // ---- GGFC (Y) ----
    const investMap = new Map(); // key "Land|Jahr" -> Zahl
    ggfcRows.forEach(r => {
      const land = T(r.geo);                 // GGFC: ausgeschriebener Name in "geo"
      const year = parseInt(r.TIME_PERIOD, 10);
      const val  = getObsValue(r);
      if (!land || !Number.isInteger(year) || val == null) return;
      if (filterAggregates && isAggregate(land)) return;
      investMap.set(`${land}|${year}`, val);
    });

    // ---- TGGE (X) ----
    const spendMap = new Map(); // key "Land|Jahr" -> Zahl
    tggeRows.forEach(r => {
      const land = T(r["Geopolitical entity (reporting)"]); // TGGE: ausgeschriebener Name hier
      const year = parseInt(r.TIME_PERIOD, 10);
      const val  = getObsValue(r);
      if (!land || !Number.isInteger(year) || val == null) return;
      if (filterAggregates && isAggregate(land)) return;
      spendMap.set(`${land}|${year}`, val);
    });

    // ---- Join je Jahr auf Land|Jahr ----
    const keys = [...spendMap.keys()].filter(k => investMap.has(k));
    if (!keys.length) {
      svg.append("text").attr("x", W/2).attr("y", H/2).attr("text-anchor","middle")
        .style("font-size","14px").text("Keine gemeinsamen Länder/Jahre gefunden.");
      console.warn("TGGE sample keys:", [...spendMap.keys()].slice(0,8));
      console.warn("GGFC sample keys:", [...investMap.keys()].slice(0,8));
      return;
    }

    const all = keys.map(k => {
      const [land, y] = k.split("|");
      return { land, year: +y, spend: spendMap.get(k), invest: investMap.get(k) };
    }).filter(d => d.year >= startYear);

    // verfügbare Jahre
    const years = [...new Set(all.map(d => d.year))].sort((a,b) => a - b);
    if (!years.length) {
      svg.append("text").attr("x", W/2).attr("y", H/2).attr("text-anchor","middle")
        .style("font-size","14px").text("Keine Daten ab dem Startjahr.");
      return;
    }

    // ---- feste Achsen über alle Jahre (stabil beim Animieren) ----
    const x = d3.scaleLinear()
      .domain(d3.extent(all, d => d.spend)).nice()
      .range([M.left, W - M.right]);
    const y = d3.scaleLinear()
      .domain([0, Math.ceil(d3.max(all, d => d.invest) + 0.5)])
      .range([H - M.bottom, M.top]);

    // Achsen
    svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d => d + "%"));
    svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + "%"));

    // Titel / Achsenlabels
    const yearLabel = svg.append("text")
      .attr("x", W/2).attr("y", M.top - 30)
      .attr("text-anchor","middle")
      .style("font-size","22px").style("font-weight","700");

    svg.append("text")
      .attr("x", (W - M.left - M.right)/2 + M.left).attr("y", H - 25)
      .attr("text-anchor","middle").style("font-size","12px")
      .text("Gesamtausgaben in % des BIP (TGGE)");

    svg.append("text")
      .attr("transform", `translate(${25}, ${(H - M.top - M.bottom)/2 + M.top}) rotate(-90)`)
      .attr("text-anchor","middle").style("font-size","12px")
      .text("Öffentliche Investitionen in % des BIP (GGFC)");

    const gPts = svg.append("g");
    const gLbl = svg.append("g");
    const isDE = d => d.land === "Germany";

    // Helper: Daten eines Jahres
    const dataOf = yTick => all.filter(d => d.year === yTick);

    // Initial
    yearLabel.text(years[0]);

    // Update-Funktion pro Jahr mit weichen Transitionen
    function update(yTick) {
      const data = dataOf(yTick);
      yearLabel.text(yTick);

      // Punkte
      const pts = gPts.selectAll("circle").data(data, d => d.land);
      pts.enter().append("circle")
        .attr("r", d => isDE(d) ? 7 : 5)
        .attr("fill", d => isDE(d) ? "#dc2626" : "#374151")
        .attr("cx", d => x(d.spend))
        .attr("cy", d => y(d.invest))
        .merge(pts)
        .transition().duration(intervalMs * 0.55)
        .attr("cx", d => x(d.spend))
        .attr("cy", d => y(d.invest));
      pts.exit().remove();

      // Labels
      const lbl = gLbl.selectAll("text.ptlbl").data(data, d => d.land);
      lbl.enter().append("text")
        .attr("class","ptlbl")
        .style("font-size", d => isDE(d) ? "12px" : "10px")
        .style("font-weight", d => isDE(d) ? "700" : "400")
        .style("fill", d => isDE(d) ? "#dc2626" : "#6b7280")
        .attr("x", d => x(d.spend) + 8)
        .attr("y", d => y(d.invest) + 4)
        .text(d => d.land)
        .merge(lbl)
        .transition().duration(intervalMs * 0.55)
        .attr("x", d => x(d.spend) + 8)
        .attr("y", d => y(d.invest) + 4)
        .text(d => d.land);
      lbl.exit().remove();
    }

    // Start Animation
    let i = 0;
    update(years[0]);
    const timer = setInterval(() => {
      update(years[i]);
      i = (i + 1) % years.length;
      // Wenn Container entfernt wird, stoppen
      if (!document.getElementById(id)) clearInterval(timer);
    }, intervalMs);

    // Debug: Germany im ersten Jahr
    const firstDE = dataOf(years[0]).find(d => d.land === "Germany");
    if (firstDE) console.log(`Germany ${years[0]} → TGGE (X): ${firstDE.spend} | GGFC (Y): ${firstDE.invest}`);
  }).catch(err => {
    console.error(err);
    svg.append("text").attr("x", W/2).attr("y", H/2).attr("text-anchor","middle")
      .style("font-size","14px").text("Daten konnten nicht geladen werden.");
  });
}
