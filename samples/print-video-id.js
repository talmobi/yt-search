const yts = require( '../src/index.js' )

const opts = { videoId: 'e9vrfEoc8_g' }

yts( opts, function ( err, video ) {
  console.log( video )
} )

