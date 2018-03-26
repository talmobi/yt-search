let yts = require( '../src/index.js' )

if ( !!process.env.production ) {
  yts = require( '../dist/yt-search.min.js' )
}

const test = require( 'tape' )

test( 'basic search', function ( t ) {
  t.plan( 2 )

  yts( 'philip glass koyaanisqatsi', function ( err, r ) {
    t.error( err, 'no errors OK!' )

    const list = r.videos

    const koyaani = list.filter( function ( song ) {
      const i = song.title.toLowerCase().indexOf( 'koyaanisqatsi' )

      const keep = (
        ( i >= 0 && i < 5 ) &&
        song.seconds > 100 &&
        song.duration.seconds > 100 &&
        song.views > 100
      )
      return keep
    } )[ 0 ]

    console.log( koyaani )

    t.ok( koyaani, 'found koyaani OK!' )
  } )
} )
