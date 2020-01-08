const _cheerio = require( 'cheerio' )
const _dasu = require( 'dasu' )
const _parallel = require( 'async.parallellimit' )

const _url = require( 'url' )

// used to escape query strings
const _querystring = require( 'querystring' )

const _humanTime = require( 'human-time' )

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
            lists: playlists,

            accounts: accounts,
            channels: accounts
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
      parseSearchBody( body, callback )
    }
  } )
}

function videoFilter ( result )
{
  return result.type === 'video'
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
  return result.type === 'list'
}

function accountFilter ( result )
{
  return result.type === 'channel'
}

// parse the plain text response body with cheerio to pin point video information
function parseSearchBody ( responseText, callback )
{
  const $ = _cheerio.load( responseText )

  const sections = $( '.yt-lockup' )

  const errors = []
  const results = []

  for ( let i = 0; i < sections.length; i++ ) {
    const section = sections[ i ]
    const content = $( '.yt-lockup-content', section )
    const title = $( '.yt-lockup-title', content )

    const a = $( 'a', title )
    const span = $( 'span', title )
    const duration = parseDuration( span.text() )

    const href = a.attr( 'href' ) || ''

    const qs = _querystring.parse( href.split( '?', 2 )[ 1 ] )

    // TODO
    console.log( qs )

    // make sure the url is correct ( skip ad urls etc )
    // ref: https://github.com/talmobi/yt-search/issues/3
    if (
      ( href.indexOf( '/watch?' ) !== 0 ) &&
      ( href.indexOf( '/user/' ) !== 0 ) &&
      ( href.indexOf( '/channel/' ) !== 0 )
    ) continue

    const videoId = qs.v
    const listId = qs.list

    let type = 'unknown' // possibly ads

    /* Standard watch?v={videoId} url's without &list=
     * query string variables
     */
    if ( videoId ) type = 'video'

    /* Playlist results can look like watch?v={videoId} url's
     * which mean they will just play that at the start when you
     * open the link. We will consider these resulsts as
     * primarily playlist results. ( Even though they're kind of
     * a combination of video + list result )
     */
    if ( listId ) type = 'list'

    /* Channel results will link to the user/channel page
     * directly. There are two types of url's that both link to
     * the same page.
     * 1. user url: ex. /user/pewdiepie
     * 2. channel url: ex. /channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw
     *
     * Why does YouTube have these two forms? Something to do
     * with google integration etc. channel urls is the newer
     * update format as well as separating users from channels I
     * guess ( 1 user can have multiple channels? )
     */
    if (
      ( href.indexOf( '/channel/' ) >= 0 ) ||
      ( href.indexOf( '/user/' ) >= 0 )
    ) type = 'channel'

    // TODO parse lists differently based on type
    let result

    try {
      switch ( type ) {
        case 'video': // video result
          // ex: https://youtube.com/watch?v=e9vrfEoc8_g
          result = _parseVideoResult( $, section )
          break
        case 'list': // playlist result
          // ex: https://youtube.com/playlist?list=PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ
          result = _parseListResult( $, section )
          break
        case 'channel': // channel result
          // ex: https://youtube.com/user/pewdiepie
          result = _parseChannelResult( $, section )
          break
      }
    } catch ( err ) {
      errors.push( err )
    }

    if ( !result ) continue // skip undefined results

    result.type = type
    results.push( result )
  }

  if ( errors.length ) {
    return callback( errors, results )
  }
  return callback( null, results )
}

/**
 * Parse result section of html containing a video result.
 *
 * @param {object} section - cheerio object
 */
function _parseVideoResult ( $, section ) {
  const content = $( '.yt-lockup-content', section )
  const title = $( '.yt-lockup-title', content )

  const a = $( 'a', title )
  const span = $( 'span', title )
  const duration = parseDuration( span.text() )

  const href = a.attr( 'href' ) || ''

  const qs = _querystring.parse( href.split( '?', 2 )[ 1 ] )

  const videoId = qs.v
  const listId = qs.list

  const description = $( '.yt-lockup-description', content ).text()

  const metaInfo = $( '.yt-lockup-meta-info', content )
  const metaInfoList = $( 'li', metaInfo )

  const agoText = $( metaInfoList[ 0 ] ).text()
  const viewsText = $( metaInfoList[ 1 ] ).text()
  const viewsCount = Number( viewsText.split( ' ' )[ 0 ].split( ',' ).join( '' ).trim() )

  const user = $( 'a[href^="/user/"]', content )
  const userId = (user.attr( 'href' )||'').replace('/user/', '')
  const userUrlText = user.text() // is same as channel name?

  const channel = $( 'a[href^="/channel/"]', content )
  const channelId = (channel.attr( 'href' )||'').replace('/channel/', '')
  const channelUrlText = channel.text()

  let channelUrl = ''
  let userUrl = ''
  if ( channelId ) {
    channelUrl = 'https://youtube.com/channel/' + channelId
  }
  if ( userId ) {
    userUrl = 'https://youtube.com/user/' + userId
  }

  const thumbnailUrl = 'https://i.ytimg.com/vi/' + videoId + '/default.jpg'
  const thumbnailUrlHQ = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'

  const result = {
    type: 'video',

    title: a.text(),
    description: description,

    url: 'https://youtube.com/watch?v=' + videoId,
    videoId: videoId,

    seconds: Number( duration.seconds ),
    timestamp: duration.timestamp,
    duration: duration,

    views: Number( viewsCount ),

    // genre: undefined,
    // TODO genre not possible to get in bulk search results

    thumbnail: thumbnailUrl,
    image: thumbnailUrlHQ,

    // TODO uploadDate not possible to get in bulk search results
    // uploadDate: undefined,
    ago: agoText,

    author: {
      // simplified details due to YouTube's funky combination
      // of user/channel id's/name (caused by Google Plus Integration)
      name: userUrlText || channelUrlText,
      id: userId || channelId,
      url:  user.attr( 'href' ) || channel.attr( 'href' ),

      // more specific details
      userId: userId,
      userName: userUrlText, // same as channelName
      userUrl: user.attr( 'href' ) || '',

      channelId: channelId,
      channelUrl: channel.attr( 'href' ) || '',
      channelName: channelUrlText
    }
  }

  return result
}
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

/* Get metadata of a single video
 */
function getVideoMetaData ( opts, callback )
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
      parseVideoBody( body, callback )
    }
  } )
}

function parseVideoBody ( responseText, callback )
{
  const $ = _cheerio.load( responseText )

  var ctx = $( '#content' )
  var song = {}

  const videoId = $('meta[itemprop=videoId]', ctx ).attr( 'content' )

  const user = $( 'link[href*="/user/"]', ctx )
  // console.log( user )
  const user_href = user.attr( 'href' )
  // console.log( userUrl )
  const userId = user_href.split( '/' ).pop()
  const userName = user_href.split( '/' ).pop()
  const userUrl = 'https://youtube.com/user/' + userId

  const channel = $( 'link[href*="/channel/"]', ctx )
  const channelId = $( 'meta[itemprop=channelId]', ctx ).attr( 'content' )
  const channelUrl = 'https://youtube.com/channel/' + channelId

  const thumbnailUrl = 'https://i.ytimg.com/vi/' + videoId + '/default.jpg'
  const thumbnailUrlHQ = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'

  // json with json in it
  const person = $( 'script[type="application/ld+json"]' ).text()
  const personJSON = JSON.parse( person )
  const channelName = personJSON.itemListElement[ 0 ].item.name

  const duration = parseHumanDuration( $( 'meta[itemprop=duration]', ctx ).attr( 'content' ) )

  const uploadDate = $('meta[itemprop=uploadDate]', ctx ).attr( 'content' )

  var song = {
    title: $('meta[itemprop=name]', ctx ).attr( 'content' ),
    description: $('meta[itemprop=description]', ctx ).attr( 'content' ),

    url: $('link[itemprop=url]', ctx ).attr( 'href' ),
    videoId: videoId,

    seconds: Number( duration.seconds ),
    timestamp: duration.timestamp,
    duration: duration,

    views: Number( $('meta[itemprop=interactionCount]', ctx ).attr( 'content' ) ),

    genre: $('meta[itemprop=genre]', ctx ).attr( 'content' ).toLowerCase(),

    uploadDate: uploadDate,
    ago: _humanTime( new Date( uploadDate ) ), // ex: 10 years ago

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

  callback( null, song )
}

function parseHumanDuration ( timestampText )
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
  getVideoMetaData( 'e9vrfEoc8_g', function ( error, song ) {
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
