const yts = require( '../src/index.js' )

const opts = { videoId: 'e9vrfEoc8_g' }

yts( opts, function ( err, video ) {
  console.log( `${ video.uploadDate } | ${ video.genre } | ${ video.title }` )
  console.log( `time: ${ video.duration.toString() }` )
  console.log( `url: ${ video.url }` )
  console.log( `thumbnail: ${ video.thumbnail }` )
  console.log( `views: ${ video.views }` )
} )
