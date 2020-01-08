const yts = require( '../src/index.js' )

yts( 'superman theme playlist', function ( err, r ) {
  if ( err ) throw err

  const videos = r.videos
  const playlists = r.playlists || r.lists
  const channels = r.channels || r.accounts

  console.log( playlists[ 0 ] )
} )
