function getPlaylistFrequency(data) {
    var playlistFrequencyMap = data.reduce(function (map, item) {
        var genre = item.playlist_genre;
        var genreData = map[genre] || { count: 0 };
        dimensions.forEach(function(attr) {
            genreData[attr] = (genreData[attr] || 0) + item[attr];
        });
        genreData.count++;
        map[genre] = genreData;
        return map;
    }, {});

    Object.values(playlistFrequencyMap).forEach(function(data) {
        dimensions.forEach(function(attr) {
            data[attr] /= data.count;
        });
    });

    return Object.entries(playlistFrequencyMap).map(function ([key, value]) {
        return { key, value };
    });
}

function convertToChartData(genreArray) {
    return genreArray.map(function (genre) {
        return {
            className: genre.key,
            axes: dimensions.map(function(attr) {
                return { radar_axis: attr, value: genre.value[attr] };
            })
        };
    });
}

var radarDiv = document.getElementById('radar-container');

var RadarChart = {
    defaultConfig: {
        containerClass: 'radar-chart',
        radar_w: radarDiv.clientWidth * 0.90,
        radar_h: radarDiv.clientHeight * 0.90,
        factor: 0.95,
        factorLegend: 1,
        levels: 3,
        levelTick: false,
        TickLength: 10,
        maxValue: 0,
        minValue: 0,
        radians: -2 * Math.PI,
        radar_axisLine: true,
        radar_axisText: true,
        circles: true,
        radius: 5,
        open: false,
        backgroundTooltipColor: "#555",
        backgroundTooltipOpacity: "0.7",
        tooltipColor: "white",
        radar_axisJoin: function (d, i) {
            return d.className || i;
        },
        tooltipFormatValue: function (d) {
            return d;
        },
        tooltipFormatClass: function (d) {
            return d;
        },
        transitionDuration: 300
    },
    chart: function () {
        // default config
        var cfg = Object.create(RadarChart.defaultConfig);

        function setTooltip(tooltip, msg) {
            if (msg === false || msg == undefined) {
                tooltip.style("display", "none");
                tooltip.classed("visible", false);
                tooltip.select("rect").classed("visible", false);
            } else {
                tooltip.classed("visible", true);
                tooltip.style("display", "block");

                var container = tooltip.node().parentNode;
                var coords = d3.mouse(container);

                tooltip.select("text").classed('visible', true).style("fill", cfg.tooltipColor);
                var padding = 5;
                var bbox = tooltip.select("text").text(msg).node().getBBox();

                tooltip.select("rect")
                    .classed('visible', true).attr("x", 0)
                    .attr("x", bbox.x - padding)
                    .attr("y", bbox.y - padding)
                    .attr("width", bbox.width + (padding * 2))
                    .attr("height", bbox.height + (padding * 2))
                    .attr("rx", "5").attr("ry", "5")
                    .style("fill", cfg.backgroundTooltipColor).style("opacity", cfg.backgroundTooltipOpacity);
                tooltip.attr("transform", "translate(" + (coords[0] + 10) + "," + (coords[1] - 10) + ")")
            }
        }


        function radar(selection) {
            selection.each(function (data) {
                var container = d3.select(this);
                var tooltip = container.selectAll('g.tooltip').data([data[0]]);

                var tt = tooltip.enter()
                    .append('g')
                    .classed('tooltip', true)

                tt.append('rect').classed("tooltip", true);
                tt.append('text').classed("tooltip", true);

                // allow simple notation
                data = data.map(function (datum) {
                    if (datum instanceof Array) {
                        datum = {axes: datum};
                    }
                    return datum;
                });

                //   var maxValue = Math.max(cfg.maxValue, d3.max(data, function(d) {
                //     return d3.max(d.axes, function(o) { return o.value; });
                // }));
                // maxValue -= cfg.minValue;
                var radar_axisMaxValues = data[0].axes.map(function (radar_axis, index) {
                    return d3.max(data, function (d) {
                        return d.axes[index].value;
                    });
                });
                var radar_axisMinValues = data[0].axes.map(function (radar_axis, index) {
                    return d3.min(data, function (d) {
                        return d.axes[index].value;
                    });
                });
                var allradar_axis = data[0].axes.map(function (i, j) {
                    return {
                        name: i.radar_axis,
                        xOffset: i.xOffset || 0,
                        yOffset: i.yOffset || 0,
                        maxValue: radar_axisMaxValues[j],
                        minValue: radar_axisMinValues[j]
                    };
                });
                //var allradar_axis = data[0].axes.map(function(i, j){ return {name: i.radar_axis, xOffset: (i.xOffset)?i.xOffset:0, yOffset: (i.yOffset)?i.yOffset:0}; });
                var total = allradar_axis.length;
                var radius = cfg.factor * Math.min(cfg.radar_w / 2, cfg.radar_h / 2);
                var radius2 = Math.min(cfg.radar_w / 2, cfg.radar_h / 2) * .95;

                container.classed(cfg.containerClass, 1);

                function getPosition(i, range, factor, func) {
                    factor = typeof factor !== 'undefined' ? factor : 1;
                    return range * (1 - factor * func(i * cfg.radians / total));
                }

                function getHorizontalPosition(i, range, factor) {
                    return getPosition(i, range, factor, Math.sin);
                }

                function getVerticalPosition(i, range, factor) {
                    return getPosition(i, range, factor, Math.cos);
                }

                // levels && radar_axises
                var levelFactors = d3.range(0, cfg.levels).map(function (level) {
                    return radius * ((level + 1) / cfg.levels);
                });

                var levelGroups = container.selectAll('g.level-group').data(levelFactors);

                levelGroups.enter().append('g');
                levelGroups.exit().remove();

                levelGroups.attr('class', function (d, i) {
                    return 'level-group level-group-' + i;
                });

                var levelLine = levelGroups.selectAll('.level').data(function (levelFactor) {
                    return d3.range(0, total).map(function () {
                        return levelFactor;
                    });
                });

                levelLine.enter().append('line');
                levelLine.exit().remove();

                if (cfg.levelTick) {
                    levelLine
                        .attr('class', 'level')
                        .attr('x1', function (levelFactor, i) {
                            if (radius == levelFactor) {
                                return getHorizontalPosition(i, levelFactor);
                            } else {
                                return getHorizontalPosition(i, levelFactor) + (cfg.TickLength / 2) * Math.cos(i * cfg.radians / total);
                            }
                        })
                        .attr('y1', function (levelFactor, i) {
                            if (radius == levelFactor) {
                                return getVerticalPosition(i, levelFactor);
                            } else {
                                return getVerticalPosition(i, levelFactor) - (cfg.TickLength / 2) * Math.sin(i * cfg.radians / total);
                            }
                        })
                        .attr('x2', function (levelFactor, i) {
                            if (radius == levelFactor) {
                                return getHorizontalPosition(i + 1, levelFactor);
                            } else {
                                return getHorizontalPosition(i, levelFactor) - (cfg.TickLength / 2) * Math.cos(i * cfg.radians / total);
                            }
                        })
                        .attr('y2', function (levelFactor, i) {
                            if (radius == levelFactor) {
                                return getVerticalPosition(i + 1, levelFactor);
                            } else {
                                return getVerticalPosition(i, levelFactor) + (cfg.TickLength / 2) * Math.sin(i * cfg.radians / total);
                            }
                        })
                        .attr('transform', function (levelFactor) {
                            return 'translate(' + (cfg.radar_w / 2 - levelFactor) + ', ' + (cfg.radar_h / 2 - levelFactor) + ')';
                        });
                } else {
                    levelLine
                        .attr('class', 'level')
                        .attr('x1', function (levelFactor, i) {
                            return getHorizontalPosition(i, levelFactor);
                        })
                        .attr('y1', function (levelFactor, i) {
                            return getVerticalPosition(i, levelFactor);
                        })
                        .attr('x2', function (levelFactor, i) {
                            return getHorizontalPosition(i + 1, levelFactor);
                        })
                        .attr('y2', function (levelFactor, i) {
                            return getVerticalPosition(i + 1, levelFactor);
                        })
                        .attr('transform', function (levelFactor) {
                            return 'translate(' + (cfg.radar_w / 2 - levelFactor) + ', ' + (cfg.radar_h / 2 - levelFactor) + ')';
                        });
                }

                data.forEach(function (d) {
                    d.axes.forEach(function (radar_axis, i) {
                        //get avg value in originalData at column: dimensions[i]

                        // console.log(radar_axis)
                        var radar_axisMaxValue = allradar_axis[i].maxValue - cfg.minValue;
                        var radar_axisMinValue = allradar_axis[i].minValue - cfg.minValue;
                        var radar_axisRange = radar_axisMaxValue - radar_axisMinValue;
                        var normalizedValue;

                            normalizedValue = (radar_axis.value - radar_axisMinValue) / radar_axisRange;
                            normalizedValue = radar_axis.value / radar_axisMaxValue;

                        radar_axis.x = (cfg.radar_w / 2 - radius2) + getHorizontalPosition(i, radius2, normalizedValue * cfg.factor);
                        radar_axis.y = (cfg.radar_h / 2 - radius2) + getVerticalPosition(i, radius2, normalizedValue * cfg.factor);
                    });
                });

                var polygon = container.selectAll(".area").data(data, cfg.radar_axisJoin);

                var polygonType = 'polygon';
                if (cfg.open) {
                    polygonType = 'polyline';
                }

                polygon.enter().append(polygonType)
                    .classed({area: 1, 'd3-enter': 1})
                    .on('mouseover', function (dd) {
                        d3.event.stopPropagation();
                        container.classed('focus', 1);
                        d3.select(this).classed('focused', 1);
                        setTooltip(tooltip, cfg.tooltipFormatClass(dd.className));
                    })
                    .on('mouseout', function () {
                        d3.event.stopPropagation();
                        container.classed('focus', 0);
                        d3.select(this).classed('focused', 0);
                        setTooltip(tooltip, false);
                    });

                polygon.exit()
                    .classed('d3-exit', 1) // trigger css transition
                    .transition().duration(cfg.transitionDuration)
                    .remove();

                polygon
                    .each(function (d, i) {

                        var classed = {'d3-exit': 0}; // if exiting element is being reused
                        classed['radar-chart-serie' + i] = 1;
                        if (d.className) {
                            classed[d.className] = 1;
                        }
                        d3.select(this).classed(classed);
                    })
                    // styles should only be transitioned with css
                    .style('stroke', function (d, i) {
                        return color(d.className, 1);
                    })
                    .style('fill', function (d, i) {
                        return color(d.className, 1);
                    })
                    .transition().duration(cfg.transitionDuration)
                    // svg attrs with js
                    .attr('points', function (d) {
                        return d.axes.map(function (p) {
                            //console.log(p)
                            return [p.x, p.y].join(',');
                        }).join(' ');
                    })
                    .each('start', function () {
                        d3.select(this).classed('d3-enter', 0); // trigger css transition
                    });

                if (cfg.circles && cfg.radius) {

                    var circleGroups = container.selectAll('g.circle-group').data(data, cfg.radar_axisJoin);

                    circleGroups.enter().append('g').classed({'circle-group': 1, 'd3-enter': 1});
                    circleGroups.exit()
                        .classed('d3-exit', 1) // trigger css transition
                        .transition().duration(cfg.transitionDuration).remove();

                    circleGroups
                        .each(function (d) {
                            var classed = {'d3-exit': 0}; // if exiting element is being reused
                            if (d.className) {
                                classed[d.className] = 1;
                            }
                            d3.select(this).classed(classed);
                        })
                        .transition().duration(cfg.transitionDuration)
                        .each('start', function () {
                            d3.select(this).classed('d3-enter', 0); // trigger css transition
                        });

                    var circle = circleGroups.selectAll('.circle').data(function (datum, i) {
                        return datum.axes.map(function (d) {
                            return [d, i, datum.className];
                        });
                    });

                    circle.enter().append('circle')
                        .classed({circle: 1, 'd3-enter': 1})
                        .on('mouseover', function (dd) {
                            d3.event.stopPropagation();
                            setTooltip(tooltip, cfg.tooltipFormatValue(dd[0].value));
                            //container.classed('focus', 1);
                            //container.select('.area.radar-chart-serie'+dd[1]).classed('focused', 1);
                        })
                        .on('mouseout', function (dd) {
                            d3.event.stopPropagation();
                            setTooltip(tooltip, false);
                            container.classed('focus', 0);
                            //container.select('.area.radar-chart-serie'+dd[1]).classed('focused', 0);
                            //No idea why previous line breaks tooltip hovering area after hoverin point.
                        });

                    circle.exit()
                        .classed('d3-exit', 1) // trigger css transition
                        .transition().duration(cfg.transitionDuration).remove();

                    circle
                        .each(function (d) {
                            var classed = {'d3-exit': 0}; // if exit element reused
                            classed['radar-chart-serie' + d[1]] = 1;
                            d3.select(this).classed(classed);
                        })
                        // styles should only be transitioned with css
                        .style('fill', function (d) {
                            return color(d[2], 1);
                        })
                        .transition().duration(cfg.transitionDuration)
                        // svg attrs with js
                        .attr('r', cfg.radius)
                        .attr('cx', function (d) {
                            return d[0].x;
                        })
                        .attr('cy', function (d) {
                            return d[0].y;
                        })
                        .each('start', function () {
                            d3.select(this).classed('d3-enter', 0); // trigger css transition
                        });

                    //Make sure layer order is correct
                    var poly_node = polygon.node();
                    poly_node.parentNode.appendChild(poly_node);

                    var cg_node = circleGroups.node();
                    cg_node.parentNode.appendChild(cg_node);
                }

                if (cfg.radar_axisLine || cfg.radar_axisText) {
                    var radar_axis = container.selectAll('.radar_axis').data(allradar_axis);

                    var newradar_axis = radar_axis.enter().append('g');
                    if (cfg.radar_axisLine) {
                        newradar_axis.append('line');
                    }
                    if (cfg.radar_axisText) {
                        newradar_axis.append('text');
                    }

                    radar_axis.exit().remove();

                    radar_axis.attr('class', 'radar_axis');

                    if (cfg.radar_axisLine) {
                        radar_axis.select('line')
                            .attr('x1', cfg.radar_w / 2)
                            .attr('y1', cfg.radar_h / 2)
                            .attr('x2', function (d, i) {
                                return (cfg.radar_w / 2 - radius2) + getHorizontalPosition(i, radius2, cfg.factor);
                            })
                            .attr('y2', function (d, i) {
                                return (cfg.radar_h / 2 - radius2) + getVerticalPosition(i, radius2, cfg.factor);
                            });
                    }

                    if (cfg.radar_axisText) {
                        radar_axis.select('text')
                            .attr('class', function (d, i) {
                                var p = getHorizontalPosition(i, 0.5);

                                return 'legend ' +
                                    ((p < 0.4) ? 'left' : ((p > 0.6) ? 'right' : 'middle'));
                            })
                            .attr('dy', function (d, i) {
                                var p = getVerticalPosition(i, 0.5);
                                return ((p < 0.1) ? '1em' : ((p > 0.9) ? '0' : '0.5em'));
                            })
                            .text(function (d) {
                                return d.name;
                            })
                            .attr('x', function (d, i) {
                                return d.xOffset + (cfg.radar_w / 2 - radius2) + getHorizontalPosition(i, radius2, cfg.factorLegend);
                            })
                            .attr('y', function (d, i) {
                                return d.yOffset + (cfg.radar_h / 2 - radius2) + getVerticalPosition(i, radius2, cfg.factorLegend);
                            });
                    }
                }

                // ensure tooltip is upmost layer
                var tooltipEl = tooltip.node();
                tooltipEl.parentNode.appendChild(tooltipEl);
            });


        }

        radar.config = function (value) {
            if (!arguments.length) {
                return cfg;
            }
            if (arguments.length > 1) {
                cfg[arguments[0]] = arguments[1];
            } else {
                d3.entries(value || {}).forEach(function (option) {
                    cfg[option.key] = option.value;
                });
            }
            return radar;
        };

        return radar;
    },
    draw: function (id, d, options) {
        var chart = RadarChart.chart().config(options);
        var cfg = chart.config();

        d3.select(id).select('svg').remove();
        d3.select(id)
            .append("svg")
            .attr("width", cfg.radar_w + 50)
            .attr("height", cfg.radar_h + 50)
            .datum(d)
            .call(chart);
    }
};

drawRadarPlot = function (data) {
    if (data == null || data.length <= 0)
        return;
    RadarChart.draw("#radar-container", convertToChartData(getPlaylistFrequency(data)));
}
