const debug = false;
var data;
var activeData;


const genre_colors = {
    "pop": [330, 100, 45],
    "edm": [120, 60, 40],
    "r&b": [240, 100, 45],
    "rock": [60, 100, 45],
    "latin": [270, 60, 40],
    "rap": [30, 100, 45],
}
function hsv_to_color(d, alpha) {
    const c = genre_colors[d];
    return ["hsla(",c[0],",",c[1],"%,",c[2],"%,",alpha,")"].join("");
}

const color = function(genre, alpha=1) {
    return hsv_to_color(genre, alpha);
};



function update(data) {
    updateStreamGraphDropdown()
    drawRadarPlot(data)
    drawStreamGraph(data)
}

function reset() {
    if(!confirm("you sure?\nIt doesnt work yet:/"))
        return;
    console.log("reset")
    reset_parallel();
}

// Export data
function export_csv() {
    console.log(actives())
}

function preprocess(d) {
    // Create an object to keep track of unique tracks
    var uniqueTracks = {};

    // Filter out duplicate tracks
    var filteredData = d.filter(function(track) {
        var key = track.track_id + track.track_name + track.track_artist;  // Create a unique key for each track
        if (uniqueTracks.hasOwnProperty(key)) {
            // If this key is already in uniqueTracks, then it's a duplicate, so we filter it out
            return false;
        } else {
            // If it's not in uniqueTracks, then it's unique, so we keep it and add its key to uniqueTracks
            uniqueTracks[key] = true;
            return true;
        }
    });

    return filteredData;
}

/**
 * Load data for the first time.
 */
d3.csv("../data/spotify_songs.csv", function(d) {
    // Convert quantitative scales to floats
    for (var k in d) {
        if (!isNaN(d[k] - 0) && k != 'id') {
            d[k] = parseFloat(d[k]) || 0;
        }
    };
    return d;
}, function(error, d) {
    if (error) throw error;
    d = preprocess(d);
    data = d;
    activeData = d;
    drawParallelCoordinates(data);
    update(data);
});

// Listen for the event
document.addEventListener('dataUpdated', function (e) {
    // The updated data is in e.detail
    activeData = e.detail;
    if(debug)
        console.log('Updated data:', activeData);

    update(activeData);
}, false);

