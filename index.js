import * as d3 from "d3";
// import {getDataset} from "./data_processing/data_processing"


var coords = [0, 100, 200, 300, 400];

var centered = false;

var vis = d3.select("#vis");

var initcircles = vis.selectAll("circle")
  .data(coords);

initcircles.enter()
  .append("circle")
  .attr("class", "red")
  .attr("cx", function(d) {
    return d;
  })
  .attr("cy", function(d) {
    return d;
  })
  .attr("r", "25");

function moveCircles() {

	var circles = vis.selectAll("circle")

  if (centered) {
    circles.transition()
      .duration(1000)
      .attr('cx', function(d) {
        return d;
      });

    centered = false;
  } else {
    circles.transition()
      .duration(1000)
      .attr('cx', 200);

    centered = true;
  }
}
