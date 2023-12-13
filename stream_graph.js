var genre_colors = {
    "pop": [185,56,23],
    "edm": [318,65,57],
    "r&b": [334,80,44],
    "rock": [10,30,12],
    "latin": [1,100,69],
    "rap": [120,56,40],
};

function hsv_to_color(d) {
    const a = 1;
    console.log(d)
    const c = genre_colors[d];
    return ["hsla(",c[0],",",c[1],"%,",c[2],"%,",a,")"].join("");
}

var streamDiv = document.getElementById('stream_graph');

// set the dimensions and margins of the graph
var margin = {top: 20, right: 30, bottom: 0, left: 10},
    streamWidth = streamDiv.clientWidth - 100,
    streamHeight =  d3.max([document.body.clientHeight-540, 240]);;

// append the stream_svg object to the body of the page
var stream_svg = d3.select("#stream_graph")
    .append("svg")
    .attr("width", streamWidth + margin.left + margin.right)
    .attr("height", streamHeight + margin.top + margin.bottom)
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

d3.csv("../data/spotify_songs.csv", function(d) {
    // Convert quantitative scales to floats
    for (var k in d) {
        if (!isNaN(d[k] - 0) && k != 'id') {
            d[k] = parseFloat(d[k]) || 0;
        }
    };
    return d;
}, function(error, data) {
    if (error) throw error;

    // Group data by genre and track_album_release_date
    var nestedData = d3.nest()
        .key(function(d) { return d.playlist_genre; })  // Group data by genre
        .key(function(d) { return new Date(d.track_album_release_date).getFullYear(); })  // Then group by year
        .rollup(function(v) {
            // For each unique genre and year combination, sum the track_popularity
            return d3.sum(v, function(d) { return d.track_popularity; });
        })
        .entries(data);

    console.log("nestedData")
    console.log(nestedData)

// Transform the nested data into a suitable format for d3.layout.stack()
    var dataPerYear = nestedData.reduce(function(acc, d) {
        d.values.forEach(function(v) {
            var existing = acc.find(function(e) { return e.x === +v.key; });
            if (existing) {
                existing[d.key] = v.values;
            } else {
                var newObj = {x: +v.key};
                Object.keys(genre_colors).forEach(function(genre) {
                    newObj[genre] = genre === d.key ? v.values : 0;
                });
                acc.push(newObj);
            }
        });
        return acc;
    }, []);


    dataPerYear.sort(function(a, b) {
        return a.x - b.x;
    });

    // First, calculate the total for each year
    var totalsPerYear = {};
    dataPerYear.forEach(function(d) {
        var total = 0;
        Object.keys(genre_colors).forEach(function(genre) {
            total += d[genre];
        });
        totalsPerYear[d.x] = total;
    });

    // Then, normalize the values
    dataPerYear.forEach(function(d) {
        Object.keys(genre_colors).forEach(function(genre) {
            d[genre] = d[genre] / totalsPerYear[d.x];
        });
    });

    console.log("dataPerYear")
    console.log(dataPerYear)

    // Calculate the maximum total track_popularity across all genres for any given year
    var maxPopularity = d3.max(dataPerYear, function(d) {
        var total = 0;
        for (var genre in genre_colors) {
            total += d[genre] || 0;
        }
        return total;
    });
    console.log("max popularity: " + maxPopularity)

// In D3 v3, we use d3.layout.stack()
    var stack = d3.layout.stack()
        .offset("zero");

// Here's how you can prepare your data for d3.layout.stack()
    const keys = Object.keys(genre_colors);
    var layers = keys.map(function(key, i) {
        var layer = dataPerYear.map(function(d) {
            return {x: d.x, y: d[key] || 0};
        });
        layer.key = key;  // Add the key to the layer
        return layer;
    });

    var stackedData = stack(layers);
    console.log("stackedData");
    console.log(stackedData);


// Define the x, y, and color scales
    var x = d3.scale.linear()
        .domain(d3.extent(data, function(d) { return new Date(d.track_album_release_date).getFullYear(); }))
        .range([0, streamWidth]);
    var y = d3.scale.linear()
        .domain([0, maxPopularity])
        .range([streamHeight * .78, height * .02]);

    var color = function(genre) {
        return hsv_to_color(genre);
    }

    var mouseover = function(d) {
        Tooltip.style("opacity", 1)
        d3.selectAll(".myArea").style("opacity", .2)
        d3.select(this)
            .style("stroke", "black")
            .style("opacity", 1)
    }
    var mousemove = function(d,i) {
        grp = keys[i]
        Tooltip.text(grp)
    }
    var mouseleave = function(d) {
        Tooltip.style("opacity", 0)
        d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none")
    }

    stream_svg.append("g")
        .attr("transform", "translate(0," + streamHeight*0.8 + ")")
        .call(d3.svg.axis().scale(x).orient("bottom").tickSize(-streamHeight*.8).ticks(5))
        .select(".domain").remove()
// Customization
    stream_svg.selectAll(".tick line").attr("stroke", "#b8b8b8")
// Add X axis label:
    stream_svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", streamWidth)
        .attr("y", streamHeight * .9)
        .text("Time (year)");

    const area = d3.svg.area()
        .x(function(d) { return x(d.x); })
        .y0(function(d) { return y(d.y0); })
        .y1(function(d) { return y(d.y0 + d.y); });

    stream_svg
        .selectAll("mylayers")
        .data(stackedData)
        .enter()
        .append("path")
        .attr("class", "myArea")
        .style("fill", function(d) { return color(d.key); })
        .attr("d", area)
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);
});


