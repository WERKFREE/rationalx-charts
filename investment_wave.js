// investment_wave_clean.js — Apple-style with Germany gradient
// Usage: drawInvestmentWave({ id: "chart", industry: 631, state: 500 });

function drawInvestmentWave({
  id,
  industry = 631,
  state = 500,
  gdp = 4100,
  title = "Investitionsankündigungen in Deutschland",
  subtitle = ""
} = {}) {
  const el = document.getElementById(id);
  if (!el) {
    setTimeout(() => drawInvestmentWave({ id, industry, state, gdp, title, subtitle }), 60);
    return;
  }

  const mount = d3.select("#" + id);
  mount.selectAll("*").remove();

  // Dimensions
  const W = Math.max(600, Math.min(el.clientWidth || 900, 1200));
  const H = 380;
  const M = { top: 70, right: 40, bottom: 40, left: 40 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const svg = mount.append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .style("background", "#ffffff")
    .style("font-family", "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif");

  // Germany gradient definition (Schwarz-Rot-Gold)
  const defs = svg.append("defs");
  
  const gradient1 = defs.append("linearGradient")
    .attr("id", "germanyGradient1")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "0%")
    .attr("y2", "100%");
  
  gradient1.append("stop").attr("offset", "0%").attr("stop-color", "#000000");
  gradient1.append("stop").attr("offset", "50%").attr("stop-color", "#DD0000");
  gradient1.append("stop").attr("offset", "100%").attr("stop-color", "#FFCE00");

  const gradient2 = defs.append("linearGradient")
    .attr("id", "germanyGradient2")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "0%")
    .attr("y2", "100%");
  
  gradient2.append("stop").attr("offset", "0%").attr("stop-color", "#1d1d1f");
  gradient2.append("stop").attr("offset", "50%").attr("stop-color", "#c41e3a");
  gradient2.append("stop").attr("offset", "100%").attr("stop-color", "#f4c430");

  // Data
  const data = [
    {
      label: "Industrie",
      value: industry,
      period: "2024–2028",
      annual: 126,
      gradient: "url(#germanyGradient1)"
    },
    {
      label: "Staat",
      value: state,
      period: "2025-2035",
      annual: null,
      gradient: "url(#germanyGradient2)"
    }
  ];

  // Title
  svg.append("text")
    .attr("x", M.left)
    .attr("y", 32)
    .attr("font-size", 24)
    .attr("font-weight", 600)
    .attr("fill", "#1d1d1f")
    .attr("letter-spacing", "-0.01em")
    .text(title);

  svg.append("text")
    .attr("x", M.left)
    .attr("y", 54)
    .attr("font-size", 15)
    .attr("font-weight", 400)
    .attr("fill", "#86868b")
    .text(subtitle);

  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  const barW = (innerW - 80) / 2;
  const barH = innerH;

  data.forEach((d, i) => {
    const xPos = i * (barW + 80);
    const bar = g.append("g").attr("transform", `translate(${xPos},0)`);

    // Large value with Germany gradient
    const valueText = bar.append("text")
      .attr("x", barW / 2)
      .attr("y", 70)
      .attr("text-anchor", "middle")
      .attr("font-size", 64)
      .attr("font-weight", 200)
      .attr("fill", d.gradient)
      .attr("letter-spacing", "-0.04em")
      .style("opacity", 0)
      .text("0");

    valueText.transition()
      .delay(400 + i * 100)
      .duration(1400)
      .ease(d3.easeCubicOut)
      .style("opacity", 1)
      .tween("text", function() {
        const interp = d3.interpolateNumber(0, d.value);
        return t => d3.select(this).text(Math.round(interp(t)));
      });

    // Animated gradient shift (optional enhancement)
    if (i === 0) {
      valueText.transition()
        .delay(1800)
        .duration(3000)
        .ease(d3.easeSinInOut)
        .attrTween("fill", () => {
          return t => {
            const stops = gradient1.selectAll("stop");
            stops.attr("offset", (_, j) => {
              const base = j * 50;
              return `${base + Math.sin(t * Math.PI * 2) * 10}%`;
            });
            return d.gradient;
          };
        })
        .on("end", function repeat() {
          d3.select(this)
            .transition()
            .duration(3000)
            .ease(d3.easeSinInOut)
            .on("end", repeat);
        });
    }

    // Unit
    bar.append("text")
      .attr("x", barW / 2)
      .attr("y", 98)
      .attr("text-anchor", "middle")
      .attr("font-size", 14)
      .attr("font-weight", 400)
      .attr("fill", "#86868b")
      .style("opacity", 0)
      .text("Mrd. €")
      .transition()
      .delay(600 + i * 100)
      .duration(600)
      .style("opacity", 1);

    // Label
    bar.append("text")
      .attr("x", barW / 2)
      .attr("y", 140)
      .attr("text-anchor", "middle")
      .attr("font-size", 17)
      .attr("font-weight", 600)
      .attr("fill", "#1d1d1f")
      .style("opacity", 0)
      .text(d.label)
      .transition()
      .delay(300 + i * 100)
      .duration(600)
      .style("opacity", 1);

    // Period
    bar.append("text")
      .attr("x", barW / 2)
      .attr("y", 162)
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .attr("font-weight", 400)
      .attr("fill", "#86868b")
      .style("opacity", 0)
      .text(d.period)
      .transition()
      .delay(400 + i * 100)
      .duration(600)
      .style("opacity", 1);

    // Metrics
    const metricsY = 195;
    
    const pct = ((d.value / gdp) * 100).toFixed(1);
    bar.append("text")
      .attr("x", barW / 2)
      .attr("y", metricsY)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 400)
      .attr("fill", "#86868b")
      .style("opacity", 0)
      .text(`${pct}% des BIP 2023`)
      .transition()
      .delay(800 + i * 100)
      .duration(600)
      .style("opacity", 1);

    if (d.annual) {
      bar.append("text")
        .attr("x", barW / 2)
        .attr("y", metricsY + 20)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("font-weight", 400)
        .attr("fill", "#86868b")
        .style("opacity", 0)
        .text(`Ø ${d.annual} Mrd. € p.a.`)
        .transition()
        .delay(900 + i * 100)
        .duration(600)
        .style("opacity", 1);
    }
  });

  // Resize
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      drawInvestmentWave({ id, industry, state, gdp, title, subtitle });
    }, 150);
  });
}
