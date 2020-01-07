const _cheerio = require( 'cheerio' )
const _dasu = require( 'dasu' )
const _parallel = require( 'async.parallellimit' )

const _url = require( 'url' )

// used to escape query strings
const _querystring = require( 'querystring' )

const DEFAULT_YT_SEARCH_QUERY_URI = (
  'https://www.youtube.com/results?'
  // 'hl=en&gl=US&category=music' +
  // '&search_query='
  // 'search_query='
)

const ONE_SECOND = 1000
const ONE_MINUTE = ONE_SECOND * 60
const TIME_TO_LIVE = ONE_MINUTE * 5

const DEFAULT_OPTS = {
  YT_SEARCH_QUERY_URI: '',
  hl: 'en', // en
  gl: 'US', // US
  category: '', // music
  pageStart: 1, // from this page of youtube search results
  pageEnd: 3 // to this page of youtube search results
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

  if ( !query ) {
    return callback(
      new Error( 'No query given.' )
    )
  }

  if ( typeof query === 'string' ) {
    opts = Object.assign( opts, { query: query } )
  } else {
    opts = Object.assign( opts, query )
  }

  if ( !opts.YT_SEARCH_QUERY_URI ) {
    let uri = DEFAULT_YT_SEARCH_QUERY_URI
    const language = ( opts.hl || opts.language || opts.lang )
    if ( language ) uri += '&hl=' + language.slice( 0, 2 )
    if ( opts.gl ) uri += '&gl=' + opts.gl
    if ( opts.category ) uri += '&category=' + opts.category
    opts.YT_SEARCH_QUERY_URI = uri
  }

  if ( opts.videoId ) {
    return getVideoMetaData( opts.videoId, callback )
  }

  query = opts.query || opts.search

  next()

  function next () {
    const q = _querystring.escape( query ).split( /\s+/ )
    const uri = opts.YT_SEARCH_QUERY_URI + '&search_query=' + q.join( '+' )

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
      3, // max 3 requests at a time
      function ( err, results ) {
        if ( err ) {
          callback( err )
        } else {
          // results array is kept in the same order as the
          // tasks were executed (not when tasks finished) by
          // the async.parallellimit library
          // combine results into a single array
          let list = []
          for ( let i = 0; i < results.length; i++ ) {
            list = list.concat( results[ 0 ] )
          }

          const videos = list.filter( videoFilter )
          const playlists = list.filter( playlistFilter )
          const accounts = list.filter( accountFilter )

          callback( null, {
            videos: videos.filter( videoFilterDuplicates ),
            playlists: playlists,
            accounts: accounts
          } )
        }
      }
    )
  }
}

/* Get metadata of a single video
 */
function videoMetaData ( opts, callback )
{
  let videoId

  if ( typeof opts === 'string' ) {
    videoId = opts
  }

  if ( typeof opts === 'object' ) {
    videoId = opts.videoId
  }

  const uri = 'https://www.youtube.com/watch?hl=en&v=' + videoId

  const params = _url.parse( uri )

  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      parsePlayVideoBody( body, callback )
    }
  } )
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

function videoFilterDuplicates ( video, index, videos )
{
  const videoId = video.videoId

  const firstIndex = videos.findIndex( function ( el ) {
    return ( videoId === el.videoId )
  } )

  return ( firstIndex === index )
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
    // console.log( duration.toString() )

    var href = a.attr( 'href' ) || ''

    // make sure the url is correct ( skip ad urls etc )
    // ref: https://github.com/talmobi/yt-search/issues/3
    if (
      ( href.indexOf( '/watch?' ) !== 0 ) &&
      ( href.indexOf( '/user/' ) !== 0 ) &&
      ( href.indexOf( '/channel/' ) !== 0 )
    ) continue

    var videoId = href.split( '=' )[ 1 ]

    var metaInfo = $( '.yt-lockup-meta-info', content )
    var metaInfoList = $( 'li', metaInfo )
    // console.log(metaInfoList)
    var agoText = $( metaInfoList[ 0 ] ).text()
    var viewsText = $( metaInfoList[ 1 ] ).text()
    // console.log(agoText)
    // console.log(viewsText)
    var viewsCount = Number( viewsText.split( ' ' )[ 0 ].split( ',' ).join( '' ).trim() )
    var user = $( 'a[href^="/user/"]', content )
    var userId = (user.attr( 'href' )||'').replace('/user/', '')
    var userName = user.text()
    var channel = $( 'a[href^="/channel/"]', content )
    var channelId = (channel.attr( 'href' )||'').replace('/channel/', '')
    var channelName = channel.text()

    var song = {
      title: a.text(),
      url: href,
      videoId: videoId,
      seconds: Number( duration.seconds ),
      timestamp: duration.timestamp,
      duration: duration,
      ago: agoText,
      views: Number( viewsCount ),

      author: {
        // simplified details due to YouTube's funky combination
        // of user/channel id's/name (caused by Google Plus Integration)
        name: userName || channelName,
        id: userId || channelId,
        url:  user.attr( 'href' ) || channel.attr( 'href' ),

        // more specific details
        userId: userId,
        userName: userName,
        userUrl: user.attr( 'href' ) || '',

        channelId: channelId,
        channelName: channelName,
        channelUrl: channel.attr( 'href' ) || ''
      }
    }

    // console.log( '"' + song.title + '" views: ' + song.views )

    songs.push( song )
  };

  // console.log(songs[0]);

  callback( null, songs )
}

function parsePlayVideoBody ( responseText, callback )
{
  const $ = _cheerio.load( responseText )

  var content = $( '#content' )
  var song = {}

  const videoId = $('meta[itemprop=videoId]', content ).attr( 'content' )

  const user = $( 'link[href*="/user/"]', content )
  // console.log( user )
  const user_href = user.attr( 'href' )
  // console.log( userUrl )
  const userId = user_href.split( '/' ).pop()
  const userName = user_href.split( '/' ).pop()
  const userUrl = 'https://youtube.com/user/' + userId

  const channel = $( 'link[href*="/channel/"]', content )
  const channelId = $( 'meta[itemprop=channelId]', content ).attr( 'content' )
  const channelUrl = 'https://youtube.com/channel/' + channelId

  const thumbnailUrl = 'https://i.ytimg.com/vi/' + videoId + '/default.jpg'
  const thumbnailUrlHQ = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'

  // json with json in it
  const person = $( 'script[type="application/ld+json"]' ).text()
  const personJSON = JSON.parse( person )
  const channelName = personJSON.itemListElement[ 0 ].item.name

  const duration = parsePlayVideoDuration( $( 'meta[itemprop=duration]', content ).attr( 'content' ) )

  var song = {
    title: $('meta[itemprop=name]', content ).attr( 'content' ),
    url: $('link[itemprop=url]', content ).attr( 'href' ),
    videoId: videoId,

    seconds: Number( duration.seconds ),
    timestamp: duration.timestamp,
    duration: duration,

    views: Number( $('meta[itemprop=interactionCount]', content ).attr( 'content' ) ),

    genre: $('meta[itemprop=genre]', content ).attr( 'content' ),
    uploadDate: $('meta[itemprop=uploadDate]', content ).attr( 'content' ),

    thumbnail: thumbnailUrl,
    image: thumbnailUrlHQ,

    author: {
      // simplified details due to YouTube's funky combination
      // of user/channel id's/name (caused by Google Plus Integration)
      name: channelName || userName,
      id: userId || channelId,
      url:  userUrl || channelUrl,

      // more specific details
      userId: userId,
      userName: userName,
      userUrl: userUrl,

      channelId: channelId,
      channelName: channelName,
      channelUrl: channelUrl
    }
  }

  /*
  var song = {
    title: a.text(),
    url: href,
    videoId: videoId,
    seconds: Number( duration.seconds ),
    timestamp: duration.timestamp,
    duration: duration,
    ago: agoText,
    views: Number( viewsCount ),

    author: {
      // simplified details due to YouTube's funky combination
      // of user/channel id's/name (caused by Google Plus Integration)
      name: userName || channelName,
      id: userId || channelId,
      url:  user.attr( 'href' ) || channel.attr( 'href' ),

      // more specific details
      userId: userId,
      userName: userName,
      userUrl: user.attr( 'href' ) || '',

      channelId: channelId,
      channelName: channelName,
      channelUrl: channel.attr( 'href' ) || ''
    }
  }
  */

  // var a = $( 'a', title )
  // var span = $( 'span', title )
  // var duration = parseDuration( span.text() )
  // // console.log( duration.toString() )

  // var href = a.attr( 'href' ) || ''


  // var videoId = href.split( '=' )[ 1 ]

  // var metaInfo = $( '.yt-lockup-meta-info', content )
  // var metaInfoList = $( 'li', metaInfo )
  // // console.log(metaInfoList)
  // var agoText = $( metaInfoList[ 0 ] ).text()
  // var viewsText = $( metaInfoList[ 1 ] ).text()
  // // console.log(agoText)
  // // console.log(viewsText)
  // var viewsCount = Number( viewsText.split( ' ' )[ 0 ].split( ',' ).join( '' ).trim() )
  // var user = $( 'a[href^="/user/"]', content )
  // var userId = (user.attr( 'href' )||'').replace('/user/', '')
  // var userName = user.text()
  // var channel = $( 'a[href^="/channel/"]', content )
  // var channelId = (channel.attr( 'href' )||'').replace('/channel/', '')
  // var channelName = channel.text()

  // console.log( '"' + song.title + '" views: ' + song.views )

  callback( null, song )
}

function parseDuration ( timestampText )
{
  var a = timestampText.split( /\s+/ )
  var lastword = a[ a.length - 1 ]

  // ex: Duration: 2:27, Kesto: 1.07.54
  // replace all non :, non digits and non .
  var timestamp = lastword.replace( /[^:.\d]/g, '' )

  if ( !timestamp ) return {
    toString: function () { return a[ 0 ] },
    seconds: 0,
    timestamp: 0
  }

  // remove trailing junk that are not digits
  while ( timestamp[ timestamp.length - 1 ].match( /\D/ ) ) {
    timestamp = timestamp.slice( 0, -1 )
  }

  // replaces all dots with nice ':'
  timestamp = timestamp.replace( /\./g, ':' )

  var t = timestamp.split( /[:.]/ )

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

function parsePlayVideoDuration ( timestampText )
{
  // ex: PT4M13S
  const pt = timestampText.slice( 0, 2 )
  let timestamp = timestampText.slice( 2 ).toUpperCase()

  if ( pt !== 'PT' ) return {
    toString: function () { return a[ 0 ] },
    seconds: 0,
    timestamp: 0
  }

  let h = timestamp.match( /\d?\dH/ )
  let m = timestamp.match( /\d?\dM/ )
  let s = timestamp.match( /\d?\dS/ )

  h = h && h[ 0 ].slice( 0, -1 ) || 0
  m = m && m[ 0 ].slice( 0, -1 ) || 0
  s = s && s[ 0 ].slice( 0, -1 ) || 0

  h = parseInt( h )
  m = parseInt( m )
  s = parseInt( s )

  timestamp = ''
  if ( h ) timestamp += ( h + ':' )
  if ( m ) timestamp += ( m + ':' )
  timestamp += s

  const seconds = ( h * 60 * 60 + m * 60 + s )

  return {
    toString: function () { return seconds + ' seconds (' + timestamp + ')' },
    seconds: seconds,
    timestamp: timestamp
  }
}

// run tests is script is run directly
if ( require.main === module ) {
  // https://www.youtube.com/watch?v=e9vrfEoc8_g
  videoMetaData( 'e9vrfEoc8_g', function ( error, song ) {
    if ( error ) throw error

    console.log( song )
  } )
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
