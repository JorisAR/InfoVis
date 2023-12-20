let normalizeStreamData = false
let selectedStreamGraphDimension = "track_popularity"
const streamDiv = document.getElementById("stream_graph");

// Set the dimensions and margins of the graph
const margin = {top: 0, right: 0, bottom: 0, left: 0},
    streamWidth = streamDiv.clientWidth * .96 - margin.right - margin.left,
    streamHeight = streamDiv.clientHeight * .96 - margin.top - margin.bottom;

// Append the stream_svg object to the body of the page
let stream_svg = d3.select("#stream_graph")
    .append("svg")
    .attr("width", streamWidth)
    .attr("height", streamHeight)
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

var Tooltip = d3.select("body")
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px")
    .style("padding", "5px");


const drawStreamGraph = function (data) {
    if (data == null || data.length <= 0)
        return;


    stream_svg.selectAll("g").remove();
    stream_svg.selectAll("text").remove();
    stream_svg.selectAll("path").remove();

    // Group data by genre and track_album_release_date
    var nestedData = d3.nest()
        .key(function (d) {
            return d.playlist_genre;
        })  // Group data by genre
        .key(function (d) {
            return new Date(d.track_album_release_date).getFullYear();
        })  // Then group by year
        .rollup(function (v) {
            // For each unique genre and year combination, sum the track_popularity
            switch (streamAggregationMode) {
                case "avg":
                    return d3.mean(v, function (d) {
                        return d[selectedStreamGraphDimension];
                    });
                case "sum":
                    return d3.sum(v, function (d) {
                        return d[selectedStreamGraphDimension];
                    });
            }

        })
        .entries(data);

    if (debug) {
        console.log("nestedData")
        console.log(nestedData)
    }

// Transform the nested data into a suitable format for d3.layout.stack()
    var dataPerYear = nestedData.reduce(function (acc, d) {
        d.values.forEach(function (v) {
            var existing = acc.find(function (e) {
                return e.x === +v.key;
            });
            if (existing) {
                existing[d.key] = v.values;
            } else {
                var newObj = {x: +v.key};
                Object.keys(genre_colors).forEach(function (genre) {
                    newObj[genre] = genre === d.key ? v.values : 0;
                });
                acc.push(newObj);
            }
        });
        return acc;
    }, []);


    dataPerYear.sort(function (a, b) {
        return a.x - b.x;
    });

    if (normalizeStreamData) {
        var totalsPerYear = {};
        dataPerYear.forEach(function (d) {
            var total = 0;
            Object.keys(genre_colors).forEach(function (genre) {
                total += d[genre];
            });
            totalsPerYear[d.x] = total;
        });
        dataPerYear.forEach(function (d) {
            Object.keys(genre_colors).forEach(function (genre) {
                d[genre] = d[genre] / totalsPerYear[d.x];
            });
        });
    }

    if (debug) {
        console.log("dataPerYear")
        console.log(dataPerYear)
    }

    // Calculate the maximum total track_popularity across all genres for any given year
    const maxPopularity = d3.max(dataPerYear, function (d) {
        let total = 0;
        for (var genre in genre_colors) {
            total += d[genre] || 0;
        }
        return total;
    });

// In D3 v3, we use d3.layout.stack()
    const stack = d3.layout.stack()
        .offset("zero");

// Here's how you can prepare your data for d3.layout.stack()
    const keys = Object.keys(genre_colors);
    const layers = keys.map(function (key, i) {
        const layer = dataPerYear.map(function (d) {
            return {x: d.x, y: d[key] || 0};
        });
        layer.key = key;  // Add the key to the layer
        return layer;
    });

    const stackedData = stack(layers);
    if (debug) {
        console.log("stackedData");
        console.log(stackedData);
    }

    const x = d3.scale.linear()
        .domain(d3.extent(data, function (d) {
            return new Date(d.track_album_release_date).getFullYear();
        }))
        .range([streamWidth * .02, streamWidth * 0.98]);
    const y = d3.scale.linear()
        .domain([0, maxPopularity])
        .range([streamHeight * .78, streamHeight * .02]);




    const area = d3.svg.area()
        .x(function (d) {
            return x(d.x);
        })
        .y0(function (d) {
            return y(d.y0);
        })
        .y1(function (d) {
            return y(d.y0 + d.y);
        });

    stream_svg
        .selectAll("mylayers")
        .data(stackedData)
        .enter()
        .append("path")
        .attr("class", "myArea")
        .style("fill", function (d) {
            return color(d.key);
        })
        .attr("d", area);

    const timeBrush = d3.svg.brush()
        .x(x)
        .on("brushend", timeBrushed);

    stream_svg.append("g")
        .attr("class", "brush")
        .call(timeBrush)
        .selectAll("rect")
        .attr("height", streamHeight);

    const yAxis = stream_svg.append("g")
        .attr("transform", "translate(" + streamWidth * 0.98 + ",0)")
        .call(d3.svg.axis().scale(y).orient("left").ticks(5));
    yAxis.select(".domain").remove();
    yAxis.selectAll(".tick text").classed("axis_label", true);


    stream_svg.append("g")
        .attr("transform", "translate(0," + streamHeight * 0.8 + ")")
        .call(d3.svg.axis().scale(x).orient("bottom").tickSize(-streamHeight * .8).ticks(5))
        .select(".domain").remove()

    stream_svg.selectAll(".tick line").attr("stroke", "#b8b8b8")

    stream_svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", streamWidth * .98)
        .attr("y", streamHeight * .85)
        .text("Time (year)");

    // Define the callback function to be called when the brush is moved
    function timeBrushed() {
        const extent = timeBrush.extent().map(Math.round);
        if (Math.abs(extent[1] - extent[0]) < 1) {
            if (extent[0] === extent[1]) {
                extent[1] += 1;
            } else {
                extent[1] = extent[0] + 1;
            }
        }
        yearExtents = extent;
        brush();
    }

};

const resetTimeBrush = function () {
    if(yearExtents === originalYearExtents)
        return;
    yearExtents = originalYearExtents;
    brush()
}

const toggleNormalization = function () {
    normalizeStreamData = !normalizeStreamData;
    drawStreamGraph(activeData);
}

let streamAggregationMode = "avg"
const toggleStreamAggregationMode = function () {
    const txt = "Stream Graph Mode: "
    const btn = document.getElementById("stream-graph-aggregation-mode-toggle");
    switch (streamAggregationMode){
        case "avg":
            streamAggregationMode = "sum"
            btn.innerText = txt + "sum"
            break;
        case "sum":
            streamAggregationMode = "avg"
            btn.innerText = txt + "mean"
            break;
    }
    drawStreamGraph(activeData);
}

const switchStreamDimension = function (value) {
    selectedStreamGraphDimension = value;
    drawStreamGraph(activeData);
}

const updateStreamGraphDropdown = function () {
    var select = document.getElementById("selectStreamGraphDimension");
    select.innerHTML = '';

    for (var i = 0; i < dimensions.length; i++) {
        var opt = dimensions[i];
        var el = document.createElement("option");
        el.textContent = opt;
        el.value = opt;
        select.appendChild(el);
    }

    if (dimensions.includes(selectedStreamGraphDimension))
        select.value = selectedStreamGraphDimension;
    else
        select.value = dimensions[0];

}
