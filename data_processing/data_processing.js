//import * as d3 from "d3";

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
    console.log(artists)  }
