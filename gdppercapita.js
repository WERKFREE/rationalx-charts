function makeSvg(sel, w=950, h=600, m={top:30,right:120,bottom:40,left:70}) {
  const svg = d3.select("#" + sel).append("svg").attr("width", w).attr("height", h);
  return { svg, w, h, m, innerW: w - m.left - m.right, innerH: h - m.top - m.bottom };
}

function drawLineChart({ id, dataFile, startYear=2010, highlight="Germany" }) {
  const { svg, innerW, innerH, m } = makeSvg(id);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  const g20 = [
    "Argentina","Australia","Brazil","Canada","China","France","Germany",
    "India","Indonesia","Italy","Japan","Mexico","Russian Federation","Russia","Saudi Arabia",
    "South Africa","Korea, Rep.","South Korea","Turkey","United Kingdom","United States",
  ];
  
  window.__G20 = g20;


  d3.csv(dataFile).then(raw => {
    const years = raw.columns.slice(4).map(y => +y).filter(y => y >= startYear);

    const long = [];
    raw.forEach(row => {
      const c = row["Country Name"];
      if (!g20.includes(c)) return;
      years.forEach(y => {
        const v = row[y];
        if (v !== "" && v != null) long.push({ country: c, year: y, value: +v });
      });
    });

    const countries = d3.group(long, d => d.country);

    const x = d3.scaleLinear().domain(d3.extent(years)).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, d3.max(long, d => d.value)]).nice().range([innerH, 0]);

    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".2s")));

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    const endLabels = [];
    let finished = 0;
    const totalCountries = Array.from(countries.keys()).length;

    countries.forEach((vals, country) => {
      // Linienklasse
      let cls;
      if (country === highlight) cls = "chart-line chart-line--highlight";
      else if (country === "European Union") cls = "chart-line"; // EU bleibt grau
      else cls = "chart-line";

      const path = g.append("path")
        .datum(vals)
        .attr("class", cls)
        .attr("d", line);

      const total = path.node().getTotalLength();

      path.attr("stroke-dasharray", `${total} ${total}`)
          .attr("stroke-dashoffset", total);

      const first = vals[0];
      const dot = g.append("circle")
        .attr("r", (country === highlight || country === "European Union") ? 5 : 3)
        .attr("fill", 
          country === highlight 
            ? "var(--highlight)" 
            : "#999"
        )
        .attr("cx", x(first.year))
        .attr("cy", y(first.value));

      let label;
      if (country === highlight || country === "European Union") {
        label = g.append("text")
          .attr("class", "chart-label")
          .attr("text-anchor", "start")
          .style("font-weight", country === highlight ? "600" : "400")
          .style("fill", country === highlight ? "var(--highlight)" : "#666")
          .text(country);
      }

      const T = 8000; // Dauer der Gesamtanimation
      const tr = path.transition().duration(T).ease(d3.easeCubicInOut);

      tr.attrTween("stroke-dashoffset", () => d3.interpolateNumber(total, 0));

      // Dot + Label folgen während Animation
      tr.tween("follow", function() {
        const node = this;
        return function(t) {
          const p = node.getPointAtLength(t * total);
          dot.attr("cx", p.x).attr("cy", p.y);
          if ((country === highlight || country === "European Union") && label) {
            label.attr("x", p.x + 8).attr("y", p.y);
          }
          // Update Year Overlay
          const yearIndex = Math.floor(t * (years.length - 1));
          d3.select("#year-overlay").text(years[yearIndex]);
        };
      }).on("end", () => {
        const last = vals[vals.length - 1];
        const X = x(last.year), Y = y(last.value);
        dot.attr("cx", X).attr("cy", Y);

        if ((country === highlight || country === "European Union") && label) {
          label.attr("x", X + 8).attr("y", Y);
        } else {
          endLabels.push({
            country,
            x: innerW + 10,
            y: Y,
            origY: Y,
            color: "#888"
          });
        }

        finished++;
        if (finished === totalCountries) {
          placeLabels(endLabels, g);
        }
      });

      // Hover-Interaktivität NUR Tooltip
      path.on("mouseover", () => {
        tooltip.style("opacity", 1)
          .html(`<b>${country}</b><br>Last: ${d3.format(",.0f")(vals[vals.length-1].value)}`)
          .style("left", (d3.event.pageX + 10) + "px")
          .style("top", (d3.event.pageY - 20) + "px");
      }).on("mousemove", () => {
        tooltip.style("left", (d3.event.pageX + 10) + "px")
               .style("top", (d3.event.pageY - 20) + "px");
      }).on("mouseout", () => {
        tooltip.style("opacity", 0);
      });
    });

    // Labels platzieren + Leader-Lines
    function placeLabels(labels, g) {
      labels.sort((a, b) => a.y - b.y);

      const minGap = 14;
      for (let i = 1; i < labels.length; i++) {
        if (labels[i].y - labels[i-1].y < minGap) {
          labels[i].y = labels[i-1].y + minGap;
        }
      }

      labels.forEach(l => {
        if (Math.abs(l.y - l.origY) > 2) {
          g.append("line")
            .attr("x1", innerW)
            .attr("y1", l.origY)
            .attr("x2", l.x)
            .attr("y2", l.y)
            .attr("stroke", "#aaa")
            .attr("stroke-width", 0.7);
        }

        g.append("text")
          .attr("class", "chart-label")
          .attr("x", l.x + 2)
          .attr("y", l.y)
          .attr("dy", "0.35em")
          .style("fill", l.color)
          .style("font-size", "12px")
          .text(l.country);
      });
    }
  });
}
