//run with: node -r top-level-await tidalhireschecker.js
const dotenv = require('dotenv');
dotenv.config();

const Tidal = require('tidal-api-wrapper');
const tidal = new Tidal({ countryCode: "DK" });

const Progress = require('cli-progress');
const bar = new Progress.Bar({});

const chalk = require('chalk');

const TIDAL_USER = process.env.TIDAL_USERNAME;
const TIDAL_PASS = process.env.TIDAL_PASSWORD;

const MAX_RESULTS = 10;

const TRACK_CACHE = {};

tidal.webToken = "kgsOOmYk3zShYrNP";

if (!process.argv.includes("-a")) {
    console.log(chalk.blueBright("\nScanning albums..."));
    //Albums
    var albumsNotHQ = [];
    var favAlbums = await tidal.login(TIDAL_USER, TIDAL_PASS)
        .then(auth => tidal.getFavoriteAlbums())
        .then((result) => {
            return result;
        })
        .catch((err) => {
            console.log(err);
        });

    for (let album of favAlbums) {
        if (!isHiRes(album)) {
            albumsNotHQ.push(album);
        }
    }

    var res = [];
    bar.start(albumsNotHQ.length, 0);
    for (let album of albumsNotHQ) {
        var altAlbums = await tidal.search(sanitize(album.title), 'albums', 10)
            .then((result) => {
                return result;
            }).catch((err) => {
                console.debug("ERR " + album.title + " - ID: " + album.id)
            });

        for (let altAlbum of altAlbums) {
            if (isHiRes(altAlbum) && sameAlbum(album, altAlbum)) {
                res.push(album);
                break;
            }
        }
        bar.increment(1);
    }
    bar.stop();

    console.log(chalk.blueBright("Found " + res.length + " albums with potential HQ versions."));
    for (album of res) {
        console.log(chalk.green(album.title + " - ID: " + album.id));
    }
    //End Albums
}

if (!process.argv.includes("-t")) {
    //Tracks
    console.log(chalk.blueBright("\nScanning tracks..."));
    var favTracks = await tidal.login(TIDAL_USER, TIDAL_PASS)
        .then(auth => tidal.getFavoriteTracks())
        .then((result) => {
            return result;
        })
        .catch((err) => {
            console.debug(err);
        });

    var tracksNotHQ = favTracks.filter(track => !isHiRes(track));

    var res = await findTracksWithHQAlts(tracksNotHQ);

    console.log(chalk.blueBright("Found " + res.length + " tracks with potential HQ versions."));
    for (track of res) {
        console.log(chalk.green(track.title + " - ID: " + track.id));
    }

    //End Tracks
}

if (!process.argv.includes("-p")) {
    //Playlists
    console.log(chalk.blueBright("\nScanning playlists..."));
    var favPlaylists = await tidal.login(TIDAL_USER, TIDAL_PASS)
        .then(auth => tidal.getPlaylists())
        .then((result) => {
            return result;
        })
        .catch((err) => {
            console.debug(err);
        });

    for (let favPlaylist of favPlaylists) {
        console.log(chalk.blueBright("\nScanning playlist " + favPlaylist.title + "..."));
        var tracks = await tidal.getPlaylistTracks(favPlaylist.uuid)
            .then((result) => {
                return result;
            })

        var tracksNotHQ = tracks.filter(track => !isHiRes(track));

        var res = await findTracksWithHQAlts(tracksNotHQ);
        console.log(chalk.blueBright("Found " + res.length + " tracks with potential HQ versions."));
        for (track of res) {
            console.log(chalk.green(track.title + " - ID: " + track.id));
        }
    }
    //End playlists
}
//console.log(Object.keys(TRACK_CACHE));
console.log("END");

async function findTracksWithHQAlts(tracks) {
    var res = [];
    bar.start(tracks.length, 0);
    for (let track of tracks) {

        if (TRACK_CACHE[track.id]) {
            res.push(track);
        } else if (TRACK_CACHE[track.id] !== false) {
            TRACK_CACHE[track.id] = false;

            var altTracks = await tidal.search(sanitize(track.title), 'tracks', MAX_RESULTS)
                .then((result) => {
                    return result;
                }).catch((err) => {
                    console.debug("ERR " + track.title + " - ID: " + track.id)
                });

            try {
                for (let altTrack of altTracks) {
                    if (isHiRes(altTrack) && sameTrack(track, altTrack)) {
                        res.push(track);
                        TRACK_CACHE[track.id] = track;
                        //console.log(track);
                        //console.log(altTrack);
                        break;
                    }
                }
            } catch (err) {
                //console.debug(err);
            }
        }
        bar.increment(1);
    }
    bar.stop();
    return res;
}

function sameAlbum(album, altAlbum) {
    return isFuzzyMatch(album.title, altAlbum.title) && isFuzzyMatch(album.artist.name, altAlbum.artist.name);
}

function sameTrack(track, altTrack) {
    return isFuzzyMatch(track.title, altTrack.title) && isFuzzyMatch(track.artist.name, altTrack.artist.name) && (Math.abs(track.duration - altTrack.duration) < 7)
}

function isFuzzyMatch(s1, s2) {
    return s1.startsWith(s2) || s2.startsWith(s1);
}

function isHiRes(track) {
    return !!track && track.audioQuality === "HI_RES";
}

function sanitize(s) {
    return s.replace(/#|’|\(.*?emaster.*?\)/gi, "");
}