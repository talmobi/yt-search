[![npm](https://img.shields.io/npm/v/yt-search.svg?maxAge=3600)](https://www.npmjs.com/package/yt-search)
[![npm](https://img.shields.io/npm/dm/yt-search.svg?maxAge=3600)](https://www.npmjs.com/package/yt-search)
[![npm](https://img.shields.io/npm/l/yt-search.svg?maxAge=3600)](https://www.npmjs.com/package/yt-search)

#  yt-search
simple youtube search API and CLI

![](https://thumbs.gfycat.com/ContentShockingCuttlefish-size_restricted.gif)

## Easy to use

#### CLI usage
```bash
npm install -g yt-search

# enter interactive search and selection
yt-search superman theme
```

#### API usage
```js
const ytSearch = require( 'yt-search' )

ytSearch( 'superman theme', function ( err, r ) {
  if ( err ) throw err

  const videos = r.videos
  const playlists = r.playlists
  const accounts = r.accounts

  const firstResult = videos[ 0 ]

  console.log( firstResult )
} )
```

#### Output
```js
{
  title: 'Superman Theme',
  url: '/watch?v=e9vrfEoc8_g',
  videoId: 'e9vrfEoc8_g',
  seconds: 253,
  timestamp: '4:13',
  duration: {
    toString: [Function: toString],
    seconds: 253,
    timestamp: '4:13'
  },
  ago: '8 years ago',
  views: 29127516,

  author: {
    name: 'Movieclips Classic Trailers',
    id: 'oldhollywoodtrailers',
    url: '/user/oldhollywoodtrailers',

    userId: 'oldhollywoodtrailers',
    userName: 'Movieclips Classic Trailers',
    userUrl: '/user/oldhollywoodtrailers',

    channelId: '',
    channelName: ''
    channelUrl: ''
  }
}
```

## About
Simple function to get youtube search results.

## Why
Not sure..

## How
Using HTTP requests and parsing the results with [cheerio](https://github.com/cheeriojs/cheerio).

CLI interactive mode with [node-fzf](https://github.com/talmobi/node-fzf)

## Usage
```bash

const opts = {
  query: 'superman theme',
  pageStart: 1, // first youtube page result
  pageEnd: 3 // up until page 3
}

ytSearch( opts, function ( err, r ) {
  if ( typeof opts === 'string' ) {
    opts = {
      query: opts,
      pageStart: 1,
      pageEnd: 3
    }
  }

  // etc
} )
```

## Installation
```bash
npm install yt-search # local module usage
```

```bash
npm install -g yt-search # global CLI usage
```

## Test
```
npm test
```
