#  yt-search - simple youtube search API and CLI

![](https://thumbs.gfycat.com/ContentShockingCuttlefish-size_restricted.gif)

## Simple to use

### CLI usage
```bash
npm install -g yt-search

# enter interactive search and selection
yt-search superman theme
```

### API usage
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

### Output
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
  views: 29127516
}
```

# About
Simple api to search youtube results.

# Why
Not sure..

# How
Using HTTP requests and parsing the results with [cheerio](https://github.com/cheeriojs/cheerio).

CLI interactive mode with [node-fzf](https://github.com/talmobi/node-fzf)

# API
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

# Installation
```bash
npm install yt-search # local API usage
```

```bash
npm install -g yt-search # global CLI usage
```

