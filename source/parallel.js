const parallelDiv = document.getElementById('parallel_chart');

let parallelWidth = parallelDiv.clientWidth * .95;
let parallelHeight = parallelDiv.clientHeight * .87;

let searchedData;
let yearExtents, originalYearExtents;
var m = [60, 10, 10, 10],
    w = parallelWidth - m[1] - m[3],
    h = parallelHeight - m[0] - m[2],
    xscale = d3.scale.ordinal().rangePoints([0, w], 1),
    yscale = {},
    dragging = {},
    line = d3.svg.line(),
    axis = d3.svg.axis().orient("left").ticks(1 + parallelHeight / 50),
    data,
    foreground,
    background,
    highlighted,
    originalDimensions,
    dimensions,
    legend,
    render_speed = 50,
    brush_count = 0,
    excluded_playlist_genres = [],
    excludeColumns = ["key", "mode", "loudness"]; // list of columns to exclude

// Scale chart and canvas height
d3.select("#parallel_chart")
    .style("height", (h + m[0] + m[2]) + "px")

d3.selectAll("canvas")
    .attr("width", w)
    .attr("height", h)
    .style("padding", m.join("px ") + "px");


// Foreground canvas for primary view
foreground = document.getElementById('foreground').getContext('2d');
foreground.globalCompositeOperation = "destination-over";
foreground.strokeStyle = "rgba(0,100,160,0.1)";
foreground.lineWidth = 1.7;
foreground.fillText("Loading...", w / 2, h / 2);

// Highlight canvas for temporary interactions
highlighted = document.getElementById('highlight').getContext('2d');
highlighted.strokeStyle = "rgba(0,100,160,1)";
highlighted.lineWidth = 4;

// Background canvas
background = document.getElementById('background').getContext('2d');
background.strokeStyle = "rgba(0,100,160,0.1)";
background.lineWidth = 1.7;

// SVG for ticks, labels, and interactions
var parallel_svg = d3.select("svg")
    .attr("width", w + m[1] + m[3])
    .attr("height", h + m[0] + m[2])
    .append("svg:g")
    .attr("transform", "translate(" + m[3] + "," + m[0] + ")");


function initYearExtents(data) {
    var releaseYears = data.map(function(d) {
        return new Date(d.track_album_release_date).getFullYear();
    });
    yearExtents = [d3.min(releaseYears), d3.max(releaseYears)];
    originalYearExtents = yearExtents;
}

// Load the data and visualization
drawParallelCoordinates = function (data) {
    searchedData = data;
    initYearExtents(data);
    // Extract the list of numerical dimensions and create a scale for each.
    xscale.domain(dimensions = d3.keys(data[0]).filter(function (k) {
        return (_.isNumber(data[0][k])) && (excludeColumns.indexOf(k) === -1) && (yscale[k] = d3.scale.linear()
            .domain(d3.extent(data, function (d) {
                return +d[k];
            }))
            .range([h, 0]));
    }).sort());

    originalDimensions = dimensions;

    // Add a playlist_genre element for each dimension.
    var g = parallel_svg.selectAll(".dimension")
        .data(dimensions)
        .enter().append("parallel_svg:g")
        .attr("class", "dimension")
        .attr("transform", function (d) {
            return "translate(" + xscale(d) + ")";
        })
        .call(d3.behavior.drag()
            .on("dragstart", function (d) {
                dragging[d] = this.__origin__ = xscale(d);
                this.__dragged__ = false;
                d3.select("#foreground").style("opacity", "0.35");
            })
            .on("drag", function (d) {
                dragging[d] = Math.min(w, Math.max(0, this.__origin__ += d3.event.dx));
                dimensions.sort(function (a, b) {
                    return position(a) - position(b);
                });
                xscale.domain(dimensions);
                g.attr("transform", function (d) {
                    return "translate(" + position(d) + ")";
                });
                brush_count++;
                this.__dragged__ = true;

                d3.select(this).select(".background").style("fill", null);
            })
            .on("dragend", function (d) {
                if (!this.__dragged__) {
                    // no movement, invert axis
                    var extent = invert_axis(d);

                } else {
                    // reorder axes
                    d3.select(this).transition().attr("transform", "translate(" + xscale(d) + ")");

                    var extent = yscale[d].brush.extent();
                }

                // TODO required to avoid a bug
                xscale.domain(dimensions);
                update_ticks(d, extent);

                // rerender
                d3.select("#foreground").style("opacity", null);
                brush();
                delete this.__dragged__;
                delete this.__origin__;
                delete dragging[d];
            }))

    // Add an axis and title.
    g.append("svg:g")
        .attr("class", "axis")
        .attr("transform", "translate(0,0)")
        .each(function (d) {
            d3.select(this).call(axis.scale(yscale[d]));
        })
        .append("svg:text")
        .attr("text-anchor", "middle")
        .attr("y", function (d, i) {
            return i % 2 == 0 ? -14 : -30
        })
        .attr("x", 0)
        .attr("class", "label")
        .text(String)
        .append("title")
        .text("Click to invert. Drag to reorder");

    // Add and store a brush for each axis.
    g.append("svg:g")
        .attr("class", "brush")
        .each(function (d) {
            d3.select(this).call(yscale[d].brush = d3.svg.brush().y(yscale[d]).on("brush", brush));
        })
        .selectAll("rect")
        .style("visibility", null)
        .attr("x", -23)
        .attr("width", 36)
        .append("title")
        .text("Drag up or down to brush along this axis");

    g.selectAll(".extent")
        .append("title")
        .text("Drag or resize this filter");


    legend = create_legend(genre_colors);

    // Render full foreground
    brush();
};

// // copy one canvas to another, grayscale
// function gray_copy(source, target) {
//     var pixels = source.getImageData(0, 0, w, h);
//     target.putImageData(grayscale(pixels), 0, 0);
// }
//
// // http://www.html5rocks.com/en/tutorials/canvas/imagefilters/
// function grayscale(pixels, args) {
//     var d = pixels.data;
//     for (var i = 0; i < d.length; i += 4) {
//         var r = d[i];
//         var g = d[i + 1];
//         var b = d[i + 2];
//         // CIE luminance for the RGB
//         // The human eye is bad at seeing red and blue, so we de-emphasize them.
//         var v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
//         d[i] = d[i + 1] = d[i + 2] = v
//     }
//     return pixels;
// };

function create_legend(genre_colors) {
    // create legend
    var legend_data = d3.select("#legend")
        .html("")
        .selectAll(".row")
        .data(_.keys(genre_colors).sort())

    // filter by playlist_genre
    var legend = legend_data
        .enter().append("div")
        .attr("title", "Hide playlist genre")
        .on("click", function (d) {
            // toggle playlist_genre
            if (_.contains(excluded_playlist_genres, d)) {
                d3.select(this).attr("title", "Hide playlist genre")
                excluded_playlist_genres = _.difference(excluded_playlist_genres, [d]);
                updateData();
                brush();
            } else {
                d3.select(this).attr("title", "Show playlist genre")
                excluded_playlist_genres.push(d);
                updateData();
                brush();

            }
        });

    legend
        .append("span")
        .style("background", function (d, i) {
            return color(d, 1)
        })
        .attr("class", "color-bar");

    legend
        .append("span")
        .attr("class", "tally")
        .text(function (d, i) {
            return 0
        });

    legend
        .append("span")
        .text(function (d, i) {
            return " " + d
        });

    return legend;
}

// render polylines i to i+render_speed
function render_range(selection, i, max, opacity) {
    selection.slice(i, max).forEach(function (d) {
        path(d, foreground, color(d.playlist_genre, opacity));
    });
};

// simple data table
function data_table(sample) {
    // sort by first column
    var sample = sample.sort(function (a, b) {
        var col = d3.keys(a)[0];
        return a[col] < b[col] ? -1 : 1;
    });

    var table = d3.select("#genre-list")
        .html("")
        .selectAll(".row")
        .data(sample)
        .enter().append("div")
        .on("mouseover", highlight)
        .on("mouseout", unhighlight);

    table
        .append("span")
        .attr("class", "color-block")
        .style("background", function (d) {
            return color(d.playlist_genre, 1)
        })

    table
        .append("span")
        .text(function (d) {
            return d.track_name + ", " + d.track_artist;
        })
}

// Adjusts rendering speed
function optimize(timer) {
    var delta = (new Date()).getTime() - timer;
    render_speed = Math.max(Math.ceil(render_speed * 30 / delta), 8);
    render_speed = Math.min(render_speed, 300);
    return (new Date()).getTime();
}

// Feedback on rendering progress
function render_stats(i, n, render_speed) {
    d3.select("#rendered-count").text(i);
    d3.select("#rendered-bar")
        .style("width", (100 * i / n) + "%");
    d3.select("#render-speed").text(render_speed);
}

// Feedback on selection
function selection_stats(opacity, n, total) {
    d3.select("#data-count").text(total);
    d3.select("#selected-count").text(n);
    d3.select("#selected-bar").style("width", (100 * n / total) + "%");
    d3.select("#opacity").text(("" + (opacity * 100)).slice(0, 4) + "%");
}

// Highlight single polyline
function highlight(d) {
    d3.select("#foreground").style("opacity", "0.25");
    d3.selectAll(".row").style("opacity", function (p) {
        return (d.playlist_genre == p) ? null : "0.3"
    });
    path(d, highlighted, color(d.playlist_genre, 1));
}

// Remove highlight
function unhighlight() {
    d3.select("#foreground").style("opacity", null);
    d3.selectAll(".row").style("opacity", null);
    highlighted.clearRect(0, 0, w, h);
}

function invert_axis(d) {
    // save extent before inverting
    if (!yscale[d].brush.empty()) {
        var extent = yscale[d].brush.extent();
    }
    if (yscale[d].inverted) {
        yscale[d].range([h, 0]);
        d3.selectAll('.label')
            .filter(function (p) {
                return p == d;
            })
            .style("text-decoration", null);
        yscale[d].inverted = false;
    } else {
        yscale[d].range([0, h]);
        d3.selectAll('.label')
            .filter(function (p) {
                return p == d;
            })
            .style("text-decoration", "underline");
        yscale[d].inverted = true;
    }
    return extent;
}

// Draw a single polyline
function path(d, ctx, color) {
    if (color) ctx.strokeStyle = color;
    ctx.beginPath();
    var x0 = xscale(0) - 15,
        y0 = yscale[dimensions[0]](d[dimensions[0]]);   // left edge
    ctx.moveTo(x0, y0);
    dimensions.map(function (p, i) {
        var x = xscale(p),
            y = yscale[p](d[p]);
        var cp1x = x - (x - x0);
        var cp1y = y0;
        var cp2x = x - .05 * (x - x0);
        var cp2y = y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        x0 = x;
        y0 = y;
    });
    ctx.lineTo(x0, y0);                               // right edge
    ctx.stroke();
};


function position(d) {
    var v = dragging[d];
    return v == null ? xscale(d) : v;
}

// Handles a brush event, toggling the display of foreground lines.
function brush() {
    brush_count++;
    var actives = dimensions.filter(function (p) {
            return !yscale[p].brush.empty();
        }),
        extents = actives.map(function (p) {
            return yscale[p].brush.extent();
        });

    // hack to hide ticks beyond extent
    var b = d3.selectAll('.dimension')[0]
        .forEach(function (element, i) {
            var dimension = d3.select(element).data()[0];
            if (_.include(actives, dimension)) {
                var extent = extents[actives.indexOf(dimension)];
                d3.select(element)
                    .selectAll('text')
                    .style('font-weight', 'bold')
                    .style('font-size', '13px')
                    .style('display', function () {
                        var value = d3.select(this).data();
                        return extent[0] <= value && value <= extent[1] ? null : "none"
                    });
            } else {
                d3.select(element)
                    .selectAll('text')
                    .style('font-size', null)
                    .style('font-weight', null)
                    .style('display', null);
            }
            d3.select(element)
                .selectAll('.label')
                .style('display', null);
        });

    // bold dimensions with label
    d3.selectAll('.label')
        .style("font-weight", function (dimension) {
            if (_.include(actives, dimension)) return "bold";
            return null;
        });

    // Get lines within extents
    var selected = [];
    data
        .filter(function (d) {
            // Check if the release year is within the ts
            var releaseYear = new Date(d.track_album_release_date).getFullYear();
            return !_.contains(excluded_playlist_genres, d.playlist_genre) && releaseYear >= yearExtents[0] && releaseYear <= yearExtents[1];
        })
        .map(function (d) {
            return actives.every(function (p, dimension) {
                return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1];
            }) ? selected.push(d) : null;
        });
    
    if (selected.length < data.length && selected.length > 0) {
        d3.select("#keep-data").attr("disabled", null);
        d3.select("#exclude-data").attr("disabled", null);
    } else {
        d3.select("#keep-data").attr("disabled", "disabled");
        d3.select("#exclude-data").attr("disabled", "disabled");
    }

    // total by playlist_genre
    var tallies = _(selected)
        .groupBy(function (d) {
            return d.playlist_genre;
        })

    // include empty playlist_genres
    _(genre_colors).each(function (v, k) {
        tallies[k] = tallies[k] || [];
    });
    var maxLength = Math.max(...Object.keys(genre_colors).map(key => tallies[key].length));

    legend
        .style("text-decoration", function (d) {
            return _.contains(excluded_playlist_genres, d) ? "line-through" : null;
        })
        .attr("class", function (d) {
            return (tallies[d].length > 0)
                ? "row"
                : "row off";
        });

    legend.selectAll(".color-bar")
        .style("width", function (d) {
            return Math.ceil(60 * tallies[d].length / maxLength) + "%";
        });

    legend.selectAll(".tally")
        .text(function (d, i) {
            return tallies[d].length
        });

    updateData(selected)
    // Render selected lines
    paths(selected, foreground, brush_count, true);
}

// render a set of polylines on a canvas
function paths(selected, ctx, count) {
    var n = selected.length,
        i = 0,
        opacity = d3.min([2 / Math.pow(n, 0.3), 1]),
        timer = (new Date()).getTime();

    selection_stats(opacity, n, data.length)



    ctx.clearRect(0, 0, w + 1, h + 1);

    // render all lines until finished or a new brush event
    function animloop() {
        if (i >= n || count < brush_count) return true;
        var max = d3.min([i + render_speed, n]);
        render_range(_.shuffle(activeData), i, max, opacity);
        render_stats(max, n, render_speed);
        i = max;
        timer = optimize(timer);  // adjusts render_speed
    };

    d3.timer(animloop);
}

/**
 * Called when user has finished selecting values in a column
 * @param d: updated dimension
 * @param extent
 */
function update_ticks(d, extent) {
    // update brushes
    if (debug)
        console.log(yscale[d]);
    if (d) {
        var brush_el = d3.selectAll(".brush")
            .filter(function (key) {
                return key == d;
            });
        // single tick
        if (extent) {
            // restore previous extent
            brush_el.call(yscale[d].brush = d3.svg.brush().y(yscale[d]).extent(extent).on("brush", brush));
        } else {
            brush_el.call(yscale[d].brush = d3.svg.brush().y(yscale[d]).on("brush", brush));
        }
    } else {
        // all ticks
        d3.selectAll(".brush")
            .each(function (d) {
                if(yscale[d]) {
                    d3.select(this).call(yscale[d].brush = d3.svg.brush().y(yscale[d]).on("brush", brush));
                }
            })
    }

    brush_count++;

    show_ticks();

    // update axes
    d3.selectAll(".axis")
        .each(function (d, i) {
            // hide lines for better performance
            d3.select(this).selectAll('line').style("display", "none");
            // transition axis numbers
            d3.select(this)
                .transition()
                .duration(720)
                .call(axis.scale(yscale[d]));

            // bring lines back
            d3.select(this).selectAll('line').transition().delay(800).style("display", null);

            d3.select(this)
                .selectAll('text')
                .style('font-weight', null)
                .style('font-size', null)
                .style('display', null);
        });
}

function updateData(data) {
    var event = new CustomEvent('dataUpdated', {detail: data});
    document.dispatchEvent(event);
}

// Rescale to new dataset domain
function rescale() {
    // reset yscales, preserving inverted state
    dimensions.forEach(function (d, i) {
        if (yscale[d].inverted) {
            yscale[d] = d3.scale.linear()
                .domain(d3.extent(data, function (p) {
                    return +p[d];
                }))
                .range([0, h]);
            yscale[d].inverted = true;
        } else {
            yscale[d] = d3.scale.linear()
                .domain(d3.extent(data, function (p) {
                    return +p[d];
                }))
                .range([h, 0]);
        }
    });

    update_ticks();

    // Render selected data
    paths(data, foreground, brush_count);
}

// Remove all but selected from the dataset
function keep_data() {
    new_data = activeData;
    if (new_data.length == 0) {
        alert("I don't mean to be rude, but I can't let you remove all the data.\n\nTry removing some brushes to get your data back. Then click 'Keep' when you've selected data you want to look closer at.");
        return false;
    }
    data = new_data;
    rescale();
    brush();
}

// Exclude selected from the dataset
function exclude_data() {
    new_data = _.difference(data, activeData);
    if (new_data.length == 0) {
        alert("I don't mean to be rude, but I can't let you remove all the data.\n\nTry selecting just a few data points then clicking 'Exclude'.");
        return false;
    }
    data = new_data;
    rescale();
    brush();
}
//Remove axis from the graph
function remove_axis(d, g) {
    dimensions = _.difference(dimensions, [d]);
    xscale.domain(dimensions);
    g.attr("transform", function (p) {
        return "translate(" + position(p) + ")";
    });
    g.filter(function (p) {
        return p == d;
    }).remove();
    update_ticks();
}

function reset_parallel(){
    dimensions = originalDimensions;
    xscale.domain(dimensions);
    d3.selectAll(".brush")
        .each(function (d) {
            if(yscale[d]) {
                d3.select(this).call(yscale[d].brush.clear());
            }
        });
    excluded_playlist_genres = [];
    rescale();
    //update_ticks();
    updateData();
    brush();
}

d3.select("#keep-data").on("click", keep_data);
d3.select("#exclude-data").on("click", exclude_data);
d3.select("#export-data").on("click", export_csv);
d3.select("#searchArtist").on("keyup", searchTrack);
d3.select("#searchTrackName").on("keyup", searchTrack);


// Appearance toggles
d3.select("#hide-ticks").on("click", hide_ticks);
d3.select("#show-ticks").on("click", show_ticks);
d3.select("#dark-theme").on("click", dark_theme);
d3.select("#light-theme").on("click", light_theme);

function dark_theme() {
    d3.select("body").attr("class", "dark");
    d3.selectAll("#dark-theme").attr("disabled", "disabled");
    d3.selectAll("#light-theme").attr("disabled", null);
}

function light_theme() {
    d3.select("body").attr("class", null);
    d3.selectAll("#light-theme").attr("disabled", "disabled");
    d3.selectAll("#dark-theme").attr("disabled", null);
}

function searchTrack() {
    var trackNameQuery = d3.select("#searchTrackName")[0][0].value;
    var artistQuery = d3.select("#searchArtist")[0][0].value;
    searchedData = activeData;
    if (trackNameQuery.length > 0) {
        searchedData = searchTrackName(searchedData, trackNameQuery);
    }
    if (artistQuery.length > 0) {
        searchedData = searchArtist(searchedData, artistQuery);
    }
    searchedData = _.shuffle(searchedData);

    data_table(searchedData.slice(0, 5));
}

function searchTrackName(selection, str) {
    pattern = new RegExp(str, "i")
    return _(selection).filter(function (d) {
        return pattern.exec(d.track_name);
    });
}

function searchArtist(selection, str) {
    pattern = new RegExp(str, "i")
    return _(selection).filter(function (d) {
        return pattern.exec(d.track_artist);
    });
}
