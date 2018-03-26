const _cheerio = require( 'cheerio' )
const _dasu = require( 'dasu' )
const _parallel = require( 'async.parallel' )

const _url = require( 'url' )

const YT_SEARCH_QUERY_URI = (
  'https://www.youtube.com/results?' +
  'hl=en&gl=US&category=music' +
  '&search_query='
)

const ONE_SECOND = 1000
const ONE_MINUTE = ONE_SECOND * 60
const TIME_TO_LIVE = ONE_MINUTE * 5

const DEFAULT_OPTS = {
  pageStart: 1,
  pageEnd: 3
}

/**
 * Exports
 **/
module.exports = function ( query, callback ) {
  search( query, callback )
}
module.exports.search = search

/**
 * Main
 */
function search ( query, callback )
{
  let opts = Object.assign( {}, DEFAULT_OPTS )

  if ( typeof query === 'string' ) {
    opts = Object.assign( opts, { query: query } )
  } else {
    opts = Object.assign( opts, query )
  }

  query = opts.query || opts.search

  next()

  function next () {
    const q = query.split( /\s+/ )
    const uri = YT_SEARCH_QUERY_URI + q.join( '+' )

    const tasks = []
    for ( let i = opts.pageStart; i < opts.pageEnd; i++ ) {
      const pageNumber = i
      tasks.push(
        function task ( taskDone ) {
          findVideos( uri, pageNumber, function ( err, videos ) {
            if ( err ) {
              taskDone( err )
            } else {
              taskDone( null, videos )
            }
          } )
        }
      )
    }

    _parallel(
      tasks,
      function ( err, results ) {
        if ( err ) {
          callback( err )
        } else {
          // merge results
          results = [].concat.apply( [], results )

          const videos = results.filter( videoFilter )
          const playlists = results.filter( playlistFilter )
          const accounts = results.filter( accountFilter )

          callback( null, {
            videos: videos,
            playlists: playlists,
            accounts: accounts
          } )
        }
      }
    )
  }
}

function findVideos ( uri, page, callback )
{
  uri += '&page=' + page

  const params = _url.parse( uri )

  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      parseResponse( body, callback )
    }
  } )
}

function videoFilter ( result )
{
  return (
    result.url.indexOf( 'watch' ) >= 0 &&
    result.url.indexOf( '&list' ) === -1 &&
    result.url.indexOf( '&user' ) === -1
  )
}

function playlistFilter ( result )
{
  return result.url.indexOf( 'list' ) >= 0
}

function accountFilter ( result )
{
  return result.url.indexOf( 'user' ) >= 0
}

// parse the plain text response body with jsom to pin point song information
function parseResponse ( responseText, callback )
{
  // var _time = Date.now();
  const $ = _cheerio.load( responseText )
  // var _delta = Date.now() - _time;
  // console.log("parsing response with cheerio, took: " + _delta + " ms");
  // var titles = $('.yt-lockup-title');
  var contents = $( '.yt-lockup-content' )
  // console.log("titles length: " + titles.length);
  var songs = []

  for ( var i = 0; i < contents.length; i++ ) {
    var content = contents[ i ]
    var title = $( '.yt-lockup-title', content )

    var a = $( 'a', title )
    var span = $( 'span', title )
    var duration = parseDuration( span.text() )

    var href = a.attr( 'href' ) || ''

    var videoId = href.split( '=' )[ 1 ]

    var metaInfo = $( '.yt-lockup-meta-info', content )
    var metaInfoList = $( 'li', metaInfo )
    // console.log(metaInfoList)
    var agoText = $( metaInfoList[ 0 ] ).text()
    var viewsText = $( metaInfoList[ 1 ] ).text()
    // console.log(agoText)
    // console.log(viewsText)
    var viewsCount = Number( viewsText.split( ' ' )[ 0 ].split( ',' ).join( '' ).trim() )

    var song = {
      title: a.text(),
      url: href,
      videoId: videoId,
      seconds: Number( duration.seconds ),
      timestamp: duration.timestamp,
      duration: duration,
      ago: agoText,
      views: Number( viewsCount )
    }

    // console.log( '"' + song.title + '" views: ' + song.views )

    songs.push( song )
  };

  // console.log(songs[0]);

  callback( null, songs )
}

function parseDuration ( timestampText )
{
  var a = timestampText.split( ' ' )
  var timestamp = a[ a.length - 1 ].replace( /[^:\d]/g, '' )

  var t = timestamp.split( ':' )

  var seconds = 0
  var exp = 0
  for ( var i = t.length - 1; i >= 0; i-- ) {
    if ( t[ i ].length <= 0 ) continue
    var number = t[ i ].replace( /\D/g, '' )
    // var exp = (t.length - 1) - i;
    seconds += parseInt( number ) * ( exp > 0 ? Math.pow( 60, exp ) : 1 )
    exp++
    if ( exp > 2 ) break
  };

  return {
    toString: function () { return seconds + ' seconds (' + timestamp + ')' },
    seconds: seconds,
    timestamp: timestamp
  }
}

// run tests is script is run directly
if ( require.main === module ) {
  test( 'superman theme' )
}

function test ( query )
{
  console.log( 'doing list search' )
  search( query, function ( error, r ) {
    if ( error ) throw error

    const videos = r.videos
    const playlists = r.playlists
    const accounts = r.accounts

    console.log( 'videos: ' + videos.length )
    console.log( 'playlists: ' + playlists.length )
    console.log( 'accounts: ' + accounts.length )

    for ( let i = 0; i < 3; i++ ) {
      const song = videos[ i ]
      const time = ` (${ song.timestamp })`
      console.log( song.title + time )
    }
  } )
}
