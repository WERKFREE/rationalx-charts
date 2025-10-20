/**
 * abgaben.js — Animiertes Waterfall (D3 v7)
 * ------------------------------------------------------------
 * Upgrade: Sanfte Morph-Animation von Prozent → Euro
 *  - Nach 5 Sekunden wechselt das Label nicht hart,
 *    sondern morph't elegant: Zahl tweened von (pct * brutto)
 *    zum Euro-Ziel, dabei leichter Scale/Opacity-Effekt.
 *
 * Nutzung:
 *  drawAbgabenChart({ id: "chart-abgaben", brutto: 45000 });
 * ------------------------------------------------------------
 */

function drawAbgabenChart({ id, brutto = 43750 }) {
  if (!document.getElementById(id)) {
    setTimeout(() => drawAbgabenChart({ id, brutto }), 50);
    return;
  }

  // -----------------------------
  // 1) Konstanten und Berechnung
  // -----------------------------
  const GROSS_PCT = 100.0;
  const GER_TAX_PCT = 51.7;           // Abgaben
  const GER_NET_PCT = 48.3;           // Netto
  const OECD_NET_EXTRA_PCT = 7.0;     // +7% Netto-Extra (OECD)

  // Euro-Ziele
  const EUR_GROSS   = Math.round(brutto);
  const EUR_TAX     = Math.round(brutto * GER_TAX_PCT / 100);
  const EUR_NET     = Math.round(brutto * GER_NET_PCT / 100);
  const EUR_OECDADD = Math.round(brutto * OECD_NET_EXTRA_PCT / 100);

  const euro = v => new Intl.NumberFormat("de-DE").format(v) + " €";

  const steps = [
    { key: "Brutto",  type: "gross" },
    { key: "Abgaben", type: "tax"   },
    { key: "Netto",   type: "net"   }
  ];

  // -----------------------------
  // 2) Layout und Skalen
  // -----------------------------
  const w = 700, h = 520, m = { top: 56, right: 40, bottom: 56, left: 80 };
  const innerW = w - m.left - m.right, innerH = h - m.top - m.bottom;

  const mount = d3.select("#" + id);
  mount.selectAll("*").remove();

  const svg = mount.append("svg").attr("width", w).attr("height", h);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const x = d3.scaleBand().domain(steps.map(d => d.key)).range([0, innerW]).padding(0.35);
  const y = d3.scaleLinear().domain([0, 100]).nice().range([innerH, 0]);

  g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x)).attr("font-size", 12);
  g.append("g").call(d3.axisLeft(y).ticks(10).tickFormat(d => d + "%")).attr("font-size", 12);

  // -----------------------------
  // 3) Helper
  // -----------------------------
  // Text mittig auf den Balken
  function centerText(xc, yTop, yBot, color = "#fff", size = 14, weight = 700) {
    return g.append("text")
      .attr("x", xc)
      .attr("y", (yTop + yBot) / 2)
      .attr("text-anchor", "middle")
      .style("font-size", size + "px")
      .style("font-weight", weight)
      .style("fill", color)
      .style("opacity", 0);
  }

  // Sanfte Morph-Animation: Prozent-Label → Euro-Wert
  // pctStart: z.B. 51.7 (ohne %), euroTarget: z.B. 22609
  function morphPctToEuro(textSel, pctStart, euroTarget, bruttoBase, delayMs = 5000, durMs = 900) {
    // 1) Start in € aus Prozent ableiten, damit der Zahlen-Tween „real" wirkt
    const startEuro = Math.round(bruttoBase * (pctStart / 100));

    // 2) Nach der Verzögerung: kurzer Scale-Down + Opacity
    textSel
      .transition()
      .delay(delayMs)
      .duration(120)
      .style("opacity", 0.2)
      .attrTween("transform", function() {
        const x = +d3.select(this).attr("x"), y = +d3.select(this).attr("y");
        // Wir nutzen transform-origin per translate(-x,-y)…scale…translate(x,y)
        return t => `translate(${x},${y}) scale(${1 - 0.05 * t}) translate(${-x},${-y})`;
      })
      .on("end", function() {
        // 3) Jetzt Zahl tweenen und gleichzeitig wieder einblenden + Scale-Up
        const that = d3.select(this);
        that.text(euro(startEuro)); // Starttext als Euro

        that.transition()
          .duration(durMs)
          .style("opacity", 1)
          .attrTween("transform", () => {
            const x = +that.attr("x"), y = +that.attr("y");
            return t => `translate(${x},${y}) scale(${0.95 + 0.05 * t}) translate(${-x},${-y})`;
          })
          .tween("text", function() {
            const i = d3.interpolateNumber(startEuro, euroTarget);
            return function(t) { this.textContent = euro(Math.round(i(t))); };
          });
      });
  }

  // -----------------------------
  // 4) Animations-Timings
  // -----------------------------
  const T_BAR = 800;             // Dauer je Balken
  const T_GAP = 100;             // kleiner Abstand
  const T_TXT = 300;             // Text-Fade-in
  const SWAP_DELAY_MS = 10000;    // Wechsel von % → € nach 5 Sekunden

  const D0 = 0;
  const D1 = D0 + T_BAR + 300;   // Start Abgaben
  const D2 = D1 + T_BAR + 300;   // Start Netto

  // -----------------------------
  // 5) Säule 1: Brutto (schwarz)
  // -----------------------------
  {
    const key = "Brutto";
    const x0 = x(key), bw = x.bandwidth();
    const yTop = y(GROSS_PCT), yBot = y(0);

    const rect = g.append("rect")
      .attr("x", x0).attr("width", bw)
      .attr("y", y(0)).attr("height", 0)
      .attr("fill", "#000");

    rect.transition().delay(D0).duration(T_BAR)
      .attr("y", yTop).attr("height", yBot - yTop);

    const label = centerText(x0 + bw/2, yTop, yBot);
    label.text("100%")
      .transition().delay(D0 + T_BAR + T_GAP).duration(T_TXT).style("opacity", 1);

    // Sanfter Morph: 100% → 43.750 € (oder brutto)
    morphPctToEuro(label, 100.0, EUR_GROSS, brutto, SWAP_DELAY_MS, 900);
  }

  // -----------------------------
  // 6) Säule 2: Abgaben (rot) + Connector zu Brutto
  // -----------------------------
  {
    const key = "Abgaben";
    const x0 = x(key), bw = x.bandwidth();
    const yTop = y(GROSS_PCT);             // 100%
    const yBot = y(100 - GER_TAX_PCT);     // 48,3%

    const rect = g.append("rect")
      .attr("x", x0).attr("width", bw)
      .attr("y", yTop).attr("height", 0)
      .attr("fill", "#dc2626");

    rect.transition().delay(D1).duration(T_BAR)
      .attr("height", yBot - yTop)
      .on("end", () => {
        // Connector: Brutto (100%) → Abgaben (Top = 100%)
        const xPrev = x("Brutto") + x.bandwidth()/2, xCurr = x0 + bw/2;
        g.append("line")
          .attr("x1", xPrev).attr("x2", xCurr)
          .attr("y1", y(GROSS_PCT)).attr("y2", y(GROSS_PCT))
          .attr("stroke", "#6b7280").attr("stroke-dasharray", "4,2")
          .attr("opacity", 0)
          .transition().duration(400).style("opacity", 1);
      });

    const label = centerText(x0 + bw/2, yTop, yBot);
    label.text("51,7%")
      .transition().delay(D1 + T_BAR + T_GAP).duration(T_TXT).style("opacity", 1);

    // Sanfter Morph: 51,7% → €-Betrag
    morphPctToEuro(label, GER_TAX_PCT, EUR_TAX, brutto, SWAP_DELAY_MS, 900);
  }

  // -----------------------------
  // 7) Säule 3: Netto (grau) + OECD-Extra (grün) + Connectoren
  // -----------------------------
  {
    const key = "Netto";
    const x0 = x(key), bw = x.bandwidth();

    // Netto (grau)
    const netTop = y(GER_NET_PCT);  // 48,3%
    const netBot = y(0);

    const netRect = g.append("rect")
      .attr("x", x0).attr("width", bw)
      .attr("y", netBot).attr("height", 0)
      .attr("fill", "#9ca3af");

    netRect.transition().delay(D2).duration(T_BAR)
      .attr("y", netTop).attr("height", netBot - netTop)
      .on("end", () => {
        // Connector: Abgaben-Unterkante (48,3%) → Netto-Oberkante (48,3%)
        const xPrev = x("Abgaben") + x.bandwidth()/2, xCurr = x0 + bw/2;
        g.append("line")
          .attr("x1", xPrev).attr("x2", xCurr)
          .attr("y1", y(100 - GER_TAX_PCT)).attr("y2", y(GER_NET_PCT))
          .attr("stroke", "#6b7280").attr("stroke-dasharray", "4,2")
          .attr("opacity", 0)
          .transition().duration(400).style("opacity", 1);
      });

    const netLabel = centerText(x0 + bw/2, netTop, netBot);
    netLabel.text("48,3%")
      .transition().delay(D2 + T_BAR + T_GAP).duration(T_TXT).style("opacity", 1);

    // Sanfter Morph: 48,3% → €-Betrag
    morphPctToEuro(netLabel, GER_NET_PCT, EUR_NET, brutto, SWAP_DELAY_MS, 900);

    // OECD-Extra (grün) auf Netto drauf (+7%)
    const oTop0 = netTop;
    const oTop1 = y(GER_NET_PCT + OECD_NET_EXTRA_PCT); // 48,3 + 7 = 55,3

    const oRect = g.append("rect")
      .attr("x", x0).attr("width", bw)
      .attr("y", oTop0).attr("height", 0)
      .attr("fill", "#16a34a");

    oRect.transition().delay(D2 + T_BAR + 150).duration(T_BAR)
      .attr("y", oTop1).attr("height", oTop0 - oTop1)
      .on("end", () => {
        // Vertikaler Connector innerhalb der Netto-Säule (Kante zu Kante)
        g.append("line")
          .attr("x1", x0 + bw/2).attr("x2", x0 + bw/2)
          .attr("y1", oTop0).attr("y2", oTop1)
          .attr("stroke", "#16a34a").attr("stroke-width", 2)
          .attr("opacity", 0)
          .transition().duration(400).style("opacity", 1);
      });

    // OECD-Label rechts: +7% → +€ (ebenfalls morph)
    const oLbl = g.append("text")
      .attr("x", x0 + bw + 10)
      .attr("y", (oTop0 + oTop1) / 2)
      .attr("text-anchor", "start")
      .style("font-size", "12px")
      .style("font-weight", 700)
      .style("fill", "#16a34a")
      .style("opacity", 0)
      .text("+7%");

    // Fade-in Animation
    oLbl.transition()
      .delay(D2 + T_BAR + 150 + T_BAR + 120)
      .duration(200)
      .style("opacity", 1);

    // Morph: 7% → EUR_OECDADD (als absolute Zahl)
    morphPctToEuro(oLbl, OECD_NET_EXTRA_PCT, EUR_OECDADD, brutto, SWAP_DELAY_MS, 900);
  }
}