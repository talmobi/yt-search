let yts = require( '../src/index.js' )

if ( !!process.env.production ) {
  yts = require( '../dist/yt-search.min.js' )
}

const test = require( 'tape' )

test( 'basic search', function ( t ) {
  t.plan( 4 )

  yts( 'philip glass', function ( err, list ) {
    t.error( err, 'no errors OK!' )

    const koyaani = list.filter( function ( song ) {
      const i = song.title.toLowerCase().indexOf( 'koyaanisqatsi' )
      return ( i >= 0 && i < 5 )
    } )[ 0 ]

    console.log( koyaani )

    t.ok( koyaani, 'found koyaani OK!' )
    t.ok( koyaani.duration.seconds > 100, 'koyaani duration OK!' )
    t.ok( koyaani.views > 100, 'koyaani views OK!' )
  } )
} )
