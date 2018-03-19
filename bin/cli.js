#!/usr/bin/env node

var fs = require( 'fs' )
var path = require( 'path' )

var ytSearch = require(
  path.join( __dirname, '../dist/yt-search.min.js' )
)

var argv = require( 'minimist' )( process.argv.slice( 2 ) )

var query = argv._.join( ' ' )

ytSearch(
  query,
  function ( err, list ) {
    if ( err ) throw err
    for ( var i = 0; i < list.length; i++ ) {
      var song = list[ i ]
      console.log( song.title + ' : ' + song.duration )
      console.log( '---------------' )
    }
  }
)
