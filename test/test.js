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
      const keep = (
        song.title.toLowerCase().indexOf( 'koyaani' ) >= 0 &&
        song.title.toLowerCase().indexOf( 'glass' ) >= 0 &&
        ( song.author.name === 'DJDumato' ) &&
        song.seconds > 100 &&
        song.duration.seconds > 100 &&
        song.views > ( 100 * 1000 )
      )

      // console.log( song )

      return keep
    } )[ 0 ]

    console.log( koyaani )

    t.ok( koyaani, 'found koyaani OK!' )
  } )
} )

test.only( 'videos, playlists and users/channels', function ( t ) {
  t.plan( 5 )

  yts( 'pewdiepie', function ( err, r ) {
    t.error( err, 'no errors OK!' )

    const videos = r.videos
    const accounts = r.accounts

    t.ok( videos.length > 0, 'videos found' )
    t.ok( accounts.length > 0, 'accounts found' )
  } )

  yts( 'pewdiepie list', function ( err, r ) {
    t.error( err, 'no errors OK!' )

    const playlists = r.playlists

    t.ok( playlists.length > 0, 'playlists found' )
  } )
} )
