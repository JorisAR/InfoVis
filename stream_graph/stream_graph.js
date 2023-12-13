var genre_colors = {
    "pop": [185,56,23],
    "edm": [318,65,57],
    "r&b": [334,80,44],
    "rock": [10,30,12],
    "latin": [1,100,69],
    "rap": [120,56,40],
  };

  function hsv_to_color(d) {
    var a = 1;
    var c = genre_colors[d];
    return ["hsla(",c[0],",",c[1],"%,",c[2],"%,",a,")"].join("");
  }

// set the dimensions and margins of the graph
var margin = {top: 20, right: 30, bottom: 0, left: 10},
    width = 980 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

// append the svg object to the body of the page
var svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

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
            var existing = acc.find(function(e) { return e.x === v.key; });
            if (existing) {
                existing[d.key] = v.value;
            } else {
                var newObj = {x: v.key};
                Object.keys(genre_colors).forEach(function(genre) {
                    newObj[genre] = genre === d.key ? v.value : 0;
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

    // console.log("dataPerYear")
    // console.log(dataPerYear)

    // Calculate the maximum total track_popularity across all genres for any given year
    var maxPopularity = d3.max(dataPerYear, function(d) {
        var total = 0;
        for (var genre in genre_colors) {
            total += d[genre] || 0;
        }
        return total;
    });
    console.log("max popularity: " + maxPopularity)
    
    var stack = d3.stack()
        //.offset(d3.stackOffsetNone)//d3.stackOffsetSilhouette
        .offset(d3.stackOffsetNone)
        .keys(Object.keys(genre_colors))
        // .value(function(d, key) { return d[key] || 0; });
    
    var stackedData = stack(dataPerYear);
    console.log("stackedData")
    console.log(stackedData)

    // Define the x, y, and color scales
    var x = d3.scaleLinear()
        .domain(d3.extent(data, function(d) { return new Date(d.track_album_release_date).getFullYear(); }))
        .range([0, width]);
    var y = d3.scaleLinear()
        .domain([0, maxPopularity])
        .range([height * .78, height * .02]);
    
    var color = function(genre) {
        return hsv_to_color(genre);
    }

    svg.append("g")
        .attr("transform", "translate(0," + height*0.8 + ")")
        .call(d3.axisBottom(x).tickSize(-height*.8).ticks(5))
        .select(".domain").remove()
    // Customization
    svg.selectAll(".tick line").attr("stroke", "#b8b8b8")
    // Add X axis label:
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height * .9)
        .text("Time (year)");    

    const area = d3.area()
        .x((d, i) => x(d.data.x)) //console.log(x(d.data.x)); return i / 61 * width;
        .y0(d => y(d[0]))
        .y1(d => y(d[1]));

    svg
        .selectAll("mylayers")
        .data(stackedData)
        .enter()
        .append("path")
          .attr("class", "myArea")
          .style("fill", function(d) { return color(d.key); })
          .attr("d", area)
        //   .on("mouseover", mouseover)
        //   .on("mousemove", mousemove)
        //   .on("mouseleave", mouseleave)
});

    // var mouseover = function(d) {
    //     Tooltip.style("opacity", 1)
    //     d3.selectAll(".myArea").style("opacity", .2)
    //     d3.select(this)
    //       .style("stroke", "black")
    //       .style("opacity", 1)
    //   }
    //   var mousemove = function(d,i) {
    //     grp = keys[i]
    //     Tooltip.text(grp)
    //   }
    //   var mouseleave = function(d) {
    //     Tooltip.style("opacity", 0)
    //     d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none")
    // }
