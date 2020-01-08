const yts = require( '../src/index.js' )

const opts = { listId: 'PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ' }

yts( opts, function ( err, playlist ) {
  console.log( `${ playlist.title }` )
  console.log( `videos: ${ playlist.videoCount }` )
  console.log( `views: ${ playlist.views }` )
  console.log( `lastUpdate: ${ playlist.lastUpdate }` )
  console.log( `thumbnail: ${ playlist.thumbnail }` )
  console.log( `author: ${ playlist.author.name }` )

  // list of videos in the playlist
  const items = playlist.items
  items.forEach( function ( item ) {
    console.log( `  ${ item.title } | ${ item.owner || item.author.name }` )
  } )
} )

