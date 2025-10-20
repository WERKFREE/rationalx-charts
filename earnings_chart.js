// earnings_chart.js — Index ab 2018=100, SEQUENZIELLE Animation + Tracking-Dots + Peak-Linie
// Reihenfolge: 1) CPI (rot) → 2) Löhne nominal (grün) → 3) Real (schwarz) → 4) Peak-Linie
// CSV-Header: Year,Quarter,RealEarnings_YoY_pct,NominalEarnings_YoY_pct,CPI_YoY_pct[,YearQuarter]
// Aufruf: drawEarningsChart({ id: "chart-earnings", dataFile: "Data/earnings.csv" })

(function(){
  const CFG = {
    w: 950, h: 520, m: { top: 36, right: 230, bottom: 46, left: 70 },
    cNom:  "#16a34a",                 // Löhne (Nominal)
    cCPI:  "#ef4444",                 // Preise (CPI)
    cReal: "#111827",                 // Real/Kaufkraft (abgeleitet)
    grid: "#eef2f7",
    txt:  "#374151",
    animMs: 5000,                     // Dauer pro Linie
    baseYear: 2019,
    areaOpacity: 0.25
  };

  // Helper: SVG-Gerüst
  if (typeof makeSvg !== "function") {
    window.makeSvg = function(sel, w=CFG.w, h=CFG.h, m=CFG.m){
      const mount = d3.select("#"+sel); mount.selectAll("*").remove();
      const svg = mount.append("svg").attr("width",w).attr("height",h);
      return { svg, w, h, m, innerW:w-m.left-m.right, innerH:h-m.top-m.bottom };
    };
  }

  // Parsing & Utils
  function quarterNum(qRaw){ const m = String(qRaw ?? "").match(/([1-4])/); return m ? +m[1] : 1; }
  function qToMonth(qn){ return ({1:0,2:3,3:6,4:9})[qn]; }
  const qDate = (y, qn) => new Date(+y, qToMonth(qn), 15);
  const fmtQ  = d3.timeFormat("Q%q %Y");
  const num   = v => Number(String(v ?? "").replace(",", "."));
  const fmt1  = d3.format(".1f");

  // Indexketten aus YoY
  function buildIndexFromYoYChains(rows, keyYoY, baseYear){
    const yoy = {};
    rows.forEach(r=>{ if(!yoy[r.year]) yoy[r.year]={}; yoy[r.year][r.qn] = r[keyYoY]; });

    const years = Array.from(new Set(rows.map(d=>d.year))).sort((a,b)=>a-b);
    const maxYear = years[years.length-1];

    const idx = {}; idx[baseYear] = {1:100,2:100,3:100,4:100};
    for(let q=1; q<=4; q++){
      for(let y=baseYear+1; y<=maxYear; y++){
        if (yoy[y] && isFinite(yoy[y][q]) && idx[y-1] && isFinite(idx[y-1][q])) {
          if(!idx[y]) idx[y]={};
          idx[y][q] = idx[y-1][q] * (1 + yoy[y][q]/100);
        }
      }
    }

    const out = [];
    for(let y=baseYear; y<=maxYear; y++){
      for(let q=1; q<=4; q++){
        if (idx[y] && isFinite(idx[y][q])) out.push({ year:y, qn:q, date:qDate(y,q), idx: idx[y][q] });
      }
    }
    return out.sort((a,b)=>a.date-b.date);
  }

  // Schnittpunkt zwischen zwei Punkten (lineare Interpolation in Zeit)
  function interpolateCross(a, b){
    const da = +a.date, db = +b.date;
    const diffA = a.idxNom - a.idxCPI;
    const diffB = b.idxNom - b.idxCPI;
    const t = diffA / (diffA - diffB);              // Anteil zwischen a→b, wo diff = 0
    const date = new Date(da + t * (db - da));
    const nom  = a.idxNom + t * (b.idxNom - a.idxNom);
    const cpi  = a.idxCPI + t * (b.idxCPI - a.idxCPI);
    return { date, idxNom: nom, idxCPI: cpi, idxReal: (nom/cpi)*100 };
  }

  // In Abschnitte (Runs) mit konstantem Vorzeichen splitten inkl. exaktem Schnittpunkt
  function splitSignedRuns(series){
    const runs = [];
    let cur = [series[0]];
    let sign = (series[0].idxNom - series[0].idxCPI) >= 0 ? 1 : -1;

    for(let i=0; i<series.length-1; i++){
      const a = series[i], b = series[i+1];
      const sa = (a.idxNom - a.idxCPI) >= 0 ? 1 : -1;
      const sb = (b.idxNom - b.idxCPI) >= 0 ? 1 : -1;

      if (sa === sb){
        cur.push(b);
      } else {
        const cross = interpolateCross(a,b);
        cur.push(cross);
        runs.push({ sign: sa, values: cur });
        cur = [cross, b];
        sign = sb;
      }
    }
    // letzter Run
    const lastSign = (series.at(-1).idxNom - series.at(-1).idxCPI) >= 0 ? 1 : -1;
    runs.push({ sign: lastSign, values: cur });
    return runs;
  }

  window.drawEarningsChart = function({ id, dataFile }){
    const { svg, innerW, innerH, m } = makeSvg(id, CFG.w, CFG.h, CFG.m);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    g.append("text").attr("x",0).attr("y",-12)
      .attr("fill", CFG.txt).attr("font-size",14).attr("font-weight",600);

    const tt = d3.select("body").selectAll("div.tt-earn").data([null]).join("div")
      .attr("class","tt-earn").style("position","absolute").style("pointer-events","none")
      .style("padding","8px 10px").style("background","rgba(15,15,15,0.92)").style("color","#fff")
      .style("border-radius","8px").style("font-size","12px").style("opacity",0);

    d3.csv(dataFile).then(raw=>{
      const rows = raw.map(r=>({
        year: +r.Year,
        qn:   quarterNum(r.Quarter),
        yoyNom: num(r.NominalEarnings_YoY_pct),
        yoyCPI: num(r.CPI_YoY_pct)
      }))
      .filter(d=>d.year>=CFG.baseYear)
      .sort((a,b)=>(a.year-b.year)||(a.qn-b.qn));

      const cpiIdx = buildIndexFromYoYChains(rows,"yoyCPI",CFG.baseYear);
      const nomIdx = buildIndexFromYoYChains(rows,"yoyNom",CFG.baseYear);

      const key = d => d.year*10 + d.qn;
      const nomMap = new Map(nomIdx.map(d=>[key(d),d]));

      const series = [];
      cpiIdx.forEach(c=>{
        const n = nomMap.get(key(c));
        if(n){ series.push({ date:c.date, idxCPI:c.idx, idxNom:n.idx, idxReal:(n.idx/c.idx)*100 }); }
      });

      const x = d3.scaleTime().domain(d3.extent(series,d=>d.date)).range([0, innerW]);
      const y = d3.scaleLinear()
        .domain([
          Math.floor(d3.min(series,d=>Math.min(d.idxCPI,d.idxNom,d.idxReal))-2),
          Math.ceil (d3.max(series,d=>Math.max(d.idxCPI,d.idxNom,d.idxReal))+2)
        ])
        .nice()
        .range([innerH,0]);

      // Achsen
      g.append("g").attr("transform",`translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));
      g.append("g").call(d3.axisLeft(y));
      g.append("line").attr("x1",0).attr("x2",innerW).attr("y1",y(100)).attr("y2",y(100))
        .attr("stroke","#e5e7eb").attr("stroke-dasharray","4,4");

      // Linien
      const lineCPI  = d3.line().x(d=>x(d.date)).y(d=>y(d.idxCPI)).curve(d3.curveMonotoneX);
      const lineNom  = d3.line().x(d=>x(d.date)).y(d=>y(d.idxNom)).curve(d3.curveMonotoneX);
      const lineReal = d3.line().x(d=>x(d.date)).y(d=>y(d.idxReal)).curve(d3.curveMonotoneX);

      // --- ROBUSTE FARBBEREICHE OHNE HAARRISSE ---
      // Runs bilden, Schnittpunkte einfügen und je Run eine geschlossene Fläche zeichnen
      const runs = splitSignedRuns(series);
      const area = d3.area()
        .x(d=>x(d.date))
        .curve(d3.curveMonotoneX);

      const areaGroup = g.append("g");
      const paths = runs.map(run => {
        const y0 = run.sign >= 0 ? (d)=>y(d.idxCPI) : (d)=>y(d.idxNom);
        const y1 = run.sign >= 0 ? (d)=>y(d.idxNom) : (d)=>y(d.idxCPI);
        return areaGroup.append("path")
          .datum(run.values)
          .attr("d", area.y0(y0).y1(y1))
          .attr("fill", run.sign >= 0 ? CFG.cNom : CFG.cCPI)
          .attr("opacity", 0) // fade-in später
          .attr("shape-rendering", "geometricPrecision");
      });

      // Linien oben drauf (decken etwaige Kanten)
      const pCPI  = g.append("path").datum(series)
        .attr("fill","none").attr("stroke",CFG.cCPI).attr("stroke-width",2.6)
        .attr("stroke-linecap","round").attr("stroke-linejoin","round")
        .attr("vector-effect","non-scaling-stroke")
        .attr("d", lineCPI);

      const pNom  = g.append("path").datum(series)
        .attr("fill","none").attr("stroke",CFG.cNom).attr("stroke-width",2.6)
        .attr("stroke-linecap","round").attr("stroke-linejoin","round")
        .attr("vector-effect","non-scaling-stroke")
        .attr("d", lineNom);

      const pReal = g.append("path").datum(series)
        .attr("fill","none").attr("stroke",CFG.cReal).attr("stroke-width",3.2)
        .attr("stroke-linecap","round").attr("stroke-linejoin","round")
        .attr("vector-effect","non-scaling-stroke")
        .attr("d", lineReal);

      // Animierter Reveal mit Tracking-Dot und Label
      function reveal(path, color, label, delay){
        const L = path.node().getTotalLength();
        const dot = g.append("circle").attr("r",5).attr("fill",color).style("opacity",0);
        const txt = g.append("text").attr("fill",color).attr("font-size",12).attr("font-weight",700).style("opacity",0).text(label);
        path.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L)
          .transition().delay(delay).duration(CFG.animMs).ease(d3.easeLinear)
          .attrTween("stroke-dashoffset", function(){
            return function(t){
              const progress = L * (1 - t);
              const p = path.node().getPointAtLength(L - progress);
              dot.attr("cx", p.x).attr("cy", p.y).style("opacity",1);
              txt.attr("x", p.x+8).attr("y", p.y-6).style("opacity",1);
              return progress;
            };
          });
      }

      const tCPI  = 0;
      const tNom  = CFG.animMs;
      const tReal = CFG.animMs*2;
      const tPeak = CFG.animMs*3;

      reveal(pCPI,  CFG.cCPI,  "Preise", tCPI);
      reveal(pNom,  CFG.cNom,  "Löhne",  tNom);
      reveal(pReal, CFG.cReal, "Kaufkraft",   tReal);

      // Flächen einblenden, wenn beide (Nom & CPI) gezeichnet sind
      paths.forEach(p => p.transition().delay(tReal).duration(600).style("opacity", CFG.areaOpacity));

      // Peak-Linie (Real)
      const last = series[series.length-1];
      const peak = series.reduce((a,b)=> b.idxReal>a.idxReal?b:a, series[0]);
      const peakLine = g.append("line")
        .attr("x1", x(peak.date)).attr("x2", x(peak.date))
        .attr("y1", y(peak.idxReal)).attr("y2", y(peak.idxReal))
        .attr("stroke", "#9ca3af").attr("stroke-dasharray", "4,2").attr("opacity", 0.95);
      peakLine.transition().delay(tPeak).duration(CFG.animMs).ease(d3.easeLinear).attr("x2", x(last.date));

      const diffPts = last.idxReal - peak.idxReal;
      const diffPct = (diffPts / peak.idxReal) * 100;
      const diffClr = diffPts >= 0 ? CFG.cNom : CFG.cCPI;
      g.append("text")
        .attr("x", x(last.date) + 8)
        .attr("y", y(peak.idxReal))
        .attr("dy", "-.3em")
        .attr("fill", diffClr)
        .attr("font-size", 12)
        .attr("font-weight", 700)
        .text(`vs Peak ${fmtQ(peak.date)}: ${fmt1(diffPts)} (${diffPts>=0?"+":""}%)`);

      // Tooltip
      const ttFmt = d3.format(".1f");
      const focus = g.append("line").attr("y1",0).attr("y2",innerH).attr("stroke","#cbd5e1").attr("opacity",0);
      svg.append("rect").attr("x", m.left).attr("y", m.top).attr("width", innerW).attr("height", innerH)
        .style("fill","transparent")
        .on("mousemove", (ev)=>{
          const xm = d3.pointer(ev, svg.node())[0] - m.left;
          const date = x.invert(Math.max(0, Math.min(innerW, xm)));
          const i = d3.leastIndex(series, s => Math.abs(+s.date - +date));
          const d = series[i];
          focus.attr("x1", x(d.date)).attr("x2", x(d.date)).attr("opacity", 1);
          tt.style("opacity",1).html(
            `<b>${fmtQ(d.date)}</b><br>`+
            `<span style="color:${CFG.cCPI}">Preise: ${ttFmt(d.idxCPI)}</span><br>`+
            `<span style="color:${CFG.cNom}">Löhne: ${ttFmt(d.idxNom)}</span><br>`+
            `<span style="color:${CFG.cReal};font-weight:700">Real/Kaufkraft: ${ttFmt(d.idxReal)}</span><br>`+
            `<span style="color:${d.idxNom>=d.idxCPI?CFG.cNom:CFG.cCPI}">Δ (Löhne − Preise): ${ttFmt(d.idxNom - d.idxCPI)}</span>`
          ).style("left",(ev.pageX+12)+"px").style("top",(ev.pageY-28)+"px");
        })
        .on("mouseout", ()=>{ focus.attr("opacity",0); tt.style("opacity",0); });
    });
  };
})();
