[![npm](https://img.shields.io/npm/v/yt-search.svg?maxAge=3600)](https://www.npmjs.com/package/yt-search)
[![npm](https://img.shields.io/npm/dm/yt-search.svg?maxAge=3600)](https://www.npmjs.com/package/yt-search)
[![npm](https://img.shields.io/npm/l/yt-search.svg?maxAge=3600)](https://www.npmjs.com/package/yt-search)
![mac](https://github.com/talmobi/yt-search/workflows/mac/badge.svg)
![ubuntu](https://github.com/talmobi/yt-search/workflows/ubuntu/badge.svg)
![windows](https://github.com/talmobi/yt-search/workflows/windows/badge.svg)

#  yt-search
simple youtube search API and CLI

![](https://thumbs.gfycat.com/ContentShockingCuttlefish-size_restricted.gif)

## Installation
```bash
npm install yt-search # local module usage
```

## CLI Usage
If you have `mpv` installed, yt-search can directly play yt videos (or audio only) 
```bash
yt-search-video Dank Memes Videos
yt-search-audio Wagner
```

## Easy to use
```javascript
const yts = require( 'yt-search' )
const r = await yts( 'superman theme' )

const videos = r.videos.slice( 0, 3 )
videos.forEach( function ( v ) {
	const views = String( v.views ).padStart( 10, ' ' )
	console.log( `${ views } | ${ v.title } (${ v.timestamp }) | ${ v.author.name }` )
} )
```

###### output
```javascript
  38295386 | Superman Theme (4:13) | Super Man
   8267273 | Superman • Main Theme • John Williams (4:26) | HD Film Tributes
    470527 | Superman Theme John Williams Extended Version (7:29) | radqo112
```

#### single video
```javascript
const video = await yts( { videoId: '_4Vt0UGwmgQ' } )
console.log( video.title + ` (${ video.duration.timestamp })` )
```
###### output
```javascript
Philip Glass. -  Koyaanisqatsi (original version) (3:29)
```

#### single playlist
```javascript
const list = await yts( { listId: 'PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ' } )

console.log( 'playlist title: ' + list.title )
list.videos.forEach( function ( video ) {
	console.log( video.title )
} )
```
###### output
```javascript
playlist title: Superman Themes
The Max Fleischer Cartoon (From "Superman")
[Deleted video]
Superman Theme
[Private video]
Superman The Animated Series Full Theme
Smallville theme song
Reprise / Fly Away
Superman Doomsday Soundtrack- Main Title
Hans Zimmer - Man of Steel Theme
Supergirl CW Soundtrack - Superman Theme Extended
```

## About
Simple function to get youtube search results.

## Why
Not sure..

## How
Using HTTP requests and parsing the results with [cheerio](https://github.com/cheeriojs/cheerio).

CLI interactive mode with [node-fzf](https://github.com/talmobi/node-fzf)

## Options
```bash
var opts = { query: 'superman theme' }
yts( opts, function ( err, r ) {
	if ( err ) throw err
	console.log( r.videos ) // video results
	console.log( r.playlists ) // playlist results
	console.log( r.channels ) // channel results
	console.log( r.live ) // live stream results
} )

var opts = { videoId: 'e9vrfEoc8_g' }
yts( opts, function ( err, video ) {
	if ( err ) throw err
	console.log( video ) // single video metadata
} )

var opts = { listId: 'PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ' }
yts( opts, function ( err, playlist ) {
	if ( err ) throw err
	console.log( playlist ) // single playlist metadata
	console.log( playlist.videos ) // playlist videos
} )
```

## Alternatives
[ytsr](https://www.npmjs.com/package/ytsr)

## Test
```
npm test
```
