// https://www.youtube.com/watch?v=X9vrfEoc8_g

const yts = require( '../src/index.js' )

// const opts = { videoId: 'e9vrfEoc8_g' }
const opts = { videoId: 'X9vrfEoc8_g' }

yts( opts, function ( err, video ) {
  if ( err ) throw err

  console.log( `${ video.uploadDate } | ${ video.genre } | ${ video.title }` )
  console.log( `time: ${ video.duration.toString() }` )
  console.log( `url: ${ video.url }` )
  console.log( `thumbnail: ${ video.thumbnail }` )
  console.log( `views: ${ video.views }` )
} )
