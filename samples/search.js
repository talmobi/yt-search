const yts = require( '../src/index.js' )

yts( 'superman theme', function ( err, r ) {
  const videos = r.videos
  const playlists = r.playlists || r.lists
  const channels = r.accounts || r.channels

  videos.forEach( function ( video ) {
    const views = String( video.views ).padStart( 10, ' ' )
    const title = video.title
    const timestamp = video.timestamp
    const seconds = video.seconds
    console.log( `${ views } | ${ title } (${ timestamp }) | ${ video.author.name }` )
  } )
} )
