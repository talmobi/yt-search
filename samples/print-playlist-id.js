const yts = require( '../src/index.js' )

const opts = { listId: 'PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ' }

yts( opts, function ( err, playlist ) {
  console.log( playlist )
} )

