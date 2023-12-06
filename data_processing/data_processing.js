function conversor(d) {
  d.danceability = +d.danceability;  // convert string to number
  d.track_popularity = +d.track_popularity;
  d.energy = +d.energy;
  d.key = +d.key;
  d.loudness = +d.loudness;
  d.mode = +d.mode;
  d.speechiness = +d.speechiness;
  d.acousticness = +d.acousticness;
  d.instrumentalness = +d.instrumentalness;
  d.liveness= +d.liveness;
  d.valence = +d.valence;
  d.tempo = +d.tempo;
  d.duration_ms = +d.duration_ms;
  return d;
}

export async function getDataset() {
    try {
      const data = await d3.csv("data/spotify_songs.csv");
      return data;
    } catch (error) {
      console.log(error);
    }
  }
  
  function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
  }

async function getRandomDataset(n) {
  const data = await d3.csv("../data/spotify_songs.csv", conversor);
  const data1 = d3.shuffle(data);
  return data1.slice(0,n);
}


function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}

// Function to return the "artist" key of each element in the dataset
async function getArtists() {
  try {
    const data = await getDataset();
    const artists = data.map(item => item.track_artist).filter(onlyUnique);
    return artists;
  } catch (error) {
    console.log(error);
  }
}

// Function to calculate mean danceability per playlist genre
async function getMeanDanceability() {
try {
  const data = await getDataset();
  let genreDanceability = {};

  // Sum up danceability per genre and count the number of songs per genre
  data.forEach(song => {
    if (genreDanceability[song.playlist_genre]) {
      genreDanceability[song.playlist_genre].sumDanceability += parseFloat(song.danceability);
      genreDanceability[song.playlist_genre].count += 1;
    } else {
      genreDanceability[song.playlist_genre] = {
        sumDanceability: parseFloat(song.danceability),
        count: 1
      };
    }
  });

  // Calculate mean danceability per genre
  for (let genre in genreDanceability) {
    genreDanceability[genre] = genreDanceability[genre].sumDanceability / genreDanceability[genre].count;
  }

  return genreDanceability;
} catch (error) {
  console.log(error);
}
}


async function printArtists() {
  const artists = await getArtists()
  console.log(artists)
}

function createScatterplotMatrix(data1, container){ 
  var data = data1.slice(0, 300);
  // Specify the chart’s dimensions.
  const width = 2000
  const height = width;
  const padding = 28;
  const columns = data1.columns.filter(d => typeof data[0][d] === "number");
  const size = (width - (columns.length + 1) * padding) / columns.length + padding;
  console.log(data1.columns)

  // Define the horizontal scales (one for each row).
  const x = columns.map(c => d3.scaleLinear()
      .domain(d3.extent(data, d => d[c]))
      .rangeRound([padding / 2, size - padding / 2]));
  
  // Define the companion vertical scales (one for each column).
  const y = x.map(x => x.copy().range([size - padding / 2, padding / 2]));


  // Define the color scale.
  const color = d3.scaleOrdinal()
      .domain(data.map(d => d.playlist_name))
      .range(d3.schemeCategory10);

  // Define the horizontal axis (it will be applied separately for each column).
  const axisx = d3.axisBottom()
      .ticks(6)
      .tickSize(size * columns.length);
  const xAxis = g => g.selectAll("g").data(x).join("g")
      .attr("transform", (d, i) => `translate(${i * size},0)`)
      .each(function(d) { return d3.select(this).call(axisx.scale(d)); })
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#ddd"));

  // Define the vertical axis (it will be applied separately for each row).
  const axisy = d3.axisLeft()
      .ticks(6)
      .tickSize(-size * columns.length);
  const yAxis = g => g.selectAll("g").data(y).join("g")
      .attr("transform", (d, i) => `translate(0,${i * size})`)
      .each(function(d) { return d3.select(this).call(axisy.scale(d)); })
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#ddd"));
  
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-padding, 0, width, height]);

  svg.append("style")
      .text(`circle.hidden { fill: #000; fill-opacity: 1; r: 1px; }`);

  svg.append("g")
      .call(xAxis);

  svg.append("g")
      .call(yAxis);

  const cell = svg.append("g")
    .selectAll("g")
    .data(d3.cross(d3.range(columns.length), d3.range(columns.length)))
    .join("g")
      .attr("transform", ([i, j]) => `translate(${i * size},${j * size})`);

  cell.append("rect")
      .attr("fill", "none")
      .attr("stroke", "#aaa")
      .attr("x", padding / 2 + 0.5)
      .attr("y", padding / 2 + 0.5)
      .attr("width", size - padding)
      .attr("height", size - padding);

  cell.each(function([i, j]) {
    d3.select(this).selectAll("circle")
      .data(data.filter(d => !isNaN(d[columns[i]]) && !isNaN(d[columns[j]])))
      .join("circle")
        .attr("cx", d => x[i](d[columns[i]]))
        .attr("cy", d => y[j](d[columns[j]]));
  });

  const circle = cell.selectAll("circle")
      .attr("r", 3.5)
      .attr("fill-opacity", 0.7)
      .attr("fill", d => color(d.playlist_name));

  svg.append("g")
      .style("font", "bold 10px sans-serif")
      .style("pointer-events", "none")
    .selectAll("text")
    .data(columns)
    .join("text")
      .attr("transform", (d, i) => `translate(${i * size},${i * size})`)
      .attr("x", padding)
      .attr("y", padding)
      .attr("dy", ".71em")
      .text(d => d);

  svg.property("value", [])
  return Object.assign(svg.node(), {scales: {color}});
}

function createPlot(){
  getDataset().then(function(data) {
    // Create your scatterplot matrix here
    var scatterplotMatrix = createScatterplotMatrix(data); // Replace this with your actual code
    // Attach the scatterplot matrix to your HTML
    d3.select("#scatterplot-matrix").append(() => scatterplotMatrix);
});
}