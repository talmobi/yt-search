#!/usr/bin/env node

var fs = require( 'fs' )
var path = require( 'path' )

var nfzf = require( 'node-fzf' )

var ytSearch = require(
  path.join( __dirname, '../dist/yt-search.min.js' )
)

var argv = require( 'minimist' )( process.argv.slice( 2 ) )

var query = argv._.join( ' ' )

ytSearch(
  query,
  function ( err, r ) {
    if ( err ) throw err

    var list = []
    var videos = r.videos

    for ( var i = 0; i < videos.length; i++ ) {
      var song = videos[ i ]
      // console.log( song.title + ' : ' + song.duration )

      var title = song.title

      var text = (
        title +
        ' ($t)'.replace( '$t', song.timestamp ) +
        ' - ' + song.videoId
      )

      list.push( text )
    }

    nfzf( list, function ( val, ind ) {
      console.log( val )

      var url = (
        'https://www.youtube.com' +
        videos[ ind ].url
      )
      console.log( url )
    } )
  }
)
