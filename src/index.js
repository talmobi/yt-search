const _cheerio = require( 'cheerio' )
const _dasu = require( 'dasu' )
const _parallel = require( 'async.parallellimit' )

const UserAgent = require( 'user-agents' )

const _url = require( 'url' )

const _jp = require( 'jsonpath' )

const _boolstring = require( 'boolstring' )

function debug () {
  if ( !_boolstring( process.env.debug || '' ) ) return
  console.log.apply( this, arguments )
}

// used to escape query strings
const _querystring = require( 'querystring' )

const _humanTime = require( 'human-time' )

const TEMPLATES = {
  YT: 'https://youtube.com',
  SEARCH_MOBILE: 'https://m.youtube.com/results',
  SEARCH_DESKTOP: 'https://youtube.com/results'
}

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
  pageEnd: 1 // to this page of youtube search results
}

/**
 * Exports
 **/
module.exports = function ( query, callback ) {
  return search( query, callback )
}
module.exports.search = search

/**
 * Main
 */
function search ( query, callback )
{
  // support promises when no callback given
  if ( !callback ) {
    return new Promise( function ( resolve, reject ) {
      search( query, function ( err, data ) {
        if ( err ) return reject( err )
        resolve( data )
      } )
    } )
  }

  let _options
  if ( typeof query === 'string' ) {
    _options = {
      query: query
    }
  } else {
    _options = query
  }


  // support common alternatives
  _options.query = _options.query || _options.search
  _options.search = _options.query

  // ignore query, only get metadata from specific video id
  if ( _options.videoId ) {
    return getVideoMetaData( _options.videoId, callback )
  }

  // ignore query, only get metadata from specific playlist id
  if ( _options.listId ) {
    return getPlaylistMetaData( _options.listId, callback )
  }

  if ( !_options.query ) {
    return callback( Error( 'yt-search: no query given' ) )
  }

  work()

  function work () {
    findMobileVideos( _options, callback )
  }
}

/* The document returned by YouTube is may be
 * different depending on the user-agent header.
 * Seems like the mobile uri versions and modern user-agents
 * get served html documents with continuation tokens (ctoken)
 * that are used to get more page results when you scroll down
 * on the page.
 * We will be using these ctokens as our strategy to get more
 * video results in this function.
 * findDesktopVideos will be using an older strategy to get
 * more video results.
 */
function findMobileVideos ( _options, callback )
{
  // querystring variables
  const q = _querystring.escape( _options.query ).split( /\s+/ )
  const hl = _options.hl || 'en'
  const gl = _options.gl || 'US'
  const category = _options.category || '' // music

  const pageStart = 1
  const pageEnd = _options.pageEnd || 1

  let queryString = '?'
  queryString += 'search_query=' + q.join( '+' )

  queryString += '&'
  queryString += '&hl=' + hl

  queryString += '&'
  queryString += '&gl=' + gl

  if ( category ) { // ex. "music"
    queryString += '&'
    queryString += '&category=' + category
  }

  const uri = TEMPLATES.SEARCH_MOBILE + queryString

  const params = _url.parse( uri )

  // We need to provide a legitimate mobile user-agent,
  // otherwise we will be 302/303 redirected.
  const userAgent = new UserAgent( {
    deviceCategory: 'mobile'
  } )

  params.headers = {
    'user-agent': userAgent,
    'accept': 'text/html'
  }

  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      if ( res.status !== 200 ) {
        return callback( 'http status: ' + res.status )
      }

      // TODO
      const fs = require( 'fs' )
      const path = require( 'path' )
      fs.writeFileSync( 'dasu.response', res.responseText, 'utf8' )

      try {
        parseMobileSearchBody( body, function ( err, results ) {
          if ( err ) return callback( err )

          const list = results

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
        } )
      } catch ( err ) {
        callback( err )
      }
    }
  } )
}

function findDesktopVideos ( _options, callback )
{
  // querystring variables
  const q = _querystring.escape( _options.query ).split( /\s+/ )
  const hl = _options.hl || 'en'
  const gl = _options.gl || 'US'
  const category = _options.category || '' // music

  const pageStart = 1
  const pageEnd = _options.pageEnd || 1

  let queryString = '?'
  queryString += 'search_query=' + q.join( '+' )

  queryString += '&'
  queryString += '&hl=' + hl

  queryString += '&'
  queryString += '&gl=' + gl

  if ( category ) { // ex. "music"
    queryString += '&'
    queryString += '&category=' + category
  }

  const uri = TEMPLATES.SEARCH_DESKTOP + queryString

  const params = _url.parse( uri )

  // We need to provide a legitimate modern desktop user-agent
  // to get a modern html results document we can parse
  const userAgent = new UserAgent( {
    deviceCategory: 'desktop'
  } )

  params.headers = {
    'user-agent': _userAgent,
    'accept': 'text/html'
  }

  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      if ( res.status !== 200 ) {
        console.log( res )
        return callback( 'http status: ' + res.status )
      }

      // TODO
      const fs = require( 'fs' )
      const path = require( 'path' )
      fs.writeFileSync( 'dasu.response', res.responseText, 'utf8' )

      try {
        parseInitialData( body, function ( err, results ) {
          if ( err ) return callback( err )

          const list = results

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
        } )
      } catch ( err ) {
        callback( err )
      }
    }
  } )
}

function search_desktop ( query, callback )
{
  // get random user agent to set as header.
  // the document returned by YouTube is going to be
  // different if we provide a modern user agent. Seems like
  // most mobile versions also get served these versions.
  // Mainly the continuation token ( ctoken ) will be provided
  // which will allow us to get the next page ( actually
  // scrolling results, as any page shows the same top results )
  // results.
  const userAgent = new UserAgent( {
    deviceCategory: 'mobile'
  } )

  // const userAgent = (
  //   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15'
  // )

  debug( 'user-agent: ' + userAgent )

  // attach it to the dasu lirbary because it's convenient
  _dasu._userAgent = userAgent

  let _resolve, _reject
  const promise = new Promise( function ( resolve, reject ) {
    _resolve = resolve
    _reject = reject
  } )

  // wrap the callback internally to support promises
  const _callback = callback
  callback = function _internal_callback ( err, data ) {
    if ( _callback ) return _callback( err, data )
    if ( err ) return _reject( err )
    _resolve( data )
  }

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
    getVideoMetaData( opts.videoId, callback )
    if ( !_callback ) return promise
    return
  }

  if ( opts.listId ) {
    getPlaylistMetaData( opts.listId, callback )
    if ( !_callback ) return promise
    return
  }

  query = opts.query || opts.search

  next()

  function next () {
    const q = _querystring.escape( query ).split( /\s+/ )
    const uri = opts.YT_SEARCH_QUERY_URI + '&search_query=' + q.join( '+' )

    // support starting from 0 index meant as first page
    if ( opts.pageStart === 0 ) {
      opts.pageStart++
      opts.pageEnd++
    }

    const tasks = []
    for ( let i = opts.pageStart; i <= opts.pageEnd; i++ ) {
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
      1, // max requests at a time
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

  if ( !_callback ) return promise
}

function findVideos ( uri, page, callback )
{
  uri += '&page=' + page

  const params = _url.parse( uri )

  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      if ( res.status !== 200 ) {
        return callback( 'http status: ' + res.status )
      }

      try {
        parseSearchBody( body, callback )
      } catch ( err ) {
        callback( err )
      }
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

// parse initial-data
function parseInitialData ( responseText, callback )
{
  const re = /{.*}/
  const $ = _cheerio.load( responseText )

  let initialData = $( 'div#initial-data' ).html()
  initialData = re.exec( initialData )

  if ( !initialData ) {
    const scripts = $( 'script' )

    for ( let i = 0; i < scripts.length; i++ ) {
      const script = $( scripts[ i ] ).html()

      // console.log( script )

      const lines = script.split( '\n' )
      lines.forEach( function ( line ) {
        if ( line.indexOf( 'responseContext' ) >= 0 ) {
          initialData = re.exec( line )
        }
      } )
    }
  }

  if ( !initialData ) {
    return callback( 'could not find inital data in the html document' )
  }

  const errors = []
  const results = []

  const json = JSON.parse( initialData[ 0 ] )

  const items = _jp.query( json, '$..itemSectionRenderer..contents.*' )

  debug( 'items.length: ' + items.length )

  for ( let i = 0; i < items.length; i++ ) {
    const item = items[ i ]

    let result = undefined
    let type = 'unknown'

    // console.log( item )

    const hasList = ( item.compactPlaylistRenderer || item.playlistRenderer )
    const hasChannel = ( item.compactChannelRenderer || item.channelRenderer )
    const hasVideo = ( item.compactVideoRenderer || item.videoRenderer )

    const listId = hasList && ( _jp.value( item, '$..playlistId' ) )
    const channelId = hasChannel && ( _jp.value( item, '$..channelId' ) )
    const videoId = hasVideo && ( _jp.value( item, '$..videoId' ) )

    if ( videoId ) {
      type = 'video'
    }

    if ( channelId ) {
      type = 'channel'
    }

    if ( listId ) {
      type = 'list'
    }

    console.log( 'listId: ' + listId )
    console.log( 'videoId: ' + videoId )

    try {
      switch ( type ) {
        case 'video':
          {
            const thumbnail = _jp.value( item, '$..thumbnail..url' )
            const title = (
              _jp.value( item, '$..title..text' ) ||
              _jp.value( item, '$..title..simpleText' )
            )

            const author_name = (
              _jp.value( item, '$..shortBylineText..text' ) ||
              _jp.value( item, '$..longBylineText..text' )
            )

            const author_url = (
              _jp.value( item, '$..shortBylineText..url' ) ||
              _jp.value( item, '$..longBylineText..url' )
            )

            // publish/upload date
            const agoText = (
              _jp.value( item, '$..publishedTimeText..text' )
            )

            const viewCountText = (
              _jp.value( item, '$..viewCountText..text' ) ||
              _jp.value( item, '$..viewCountText..simpleText' )
            )

            const viewsCount = Number( viewCountText.split( /\s+/ )[ 0 ].split( /[,.]/ ).join( '' ).trim() )

            const lengthText = (
              _jp.value( item, '$..lengthText..text' ) ||
              _jp.value( item, '$..lengthText..simpleText' )
            )
            const duration = parseDuration( lengthText )

            const description = (
              _jp.value( item, '$..description..text' ) ||
              _jp.value( item, '$..descriptionSnippet..text' )
            )

            // url ( playlist )
            // const url = _jp.value( item, '$..navigationEndpoint..url' )
            const url = TEMPLATES.YT + '/watch?v=' + videoId

            result = {
              type: 'video',

              videoId: videoId,
              url: url,

              title: title.trim(),
              description: description,

              thumbnail: _normalizeThumbnail( thumbnail ),

              seconds: Number( duration.seconds ),
              timestamp: duration.timestamp,
              duration: duration,

              ago: agoText,
              views: Number( viewsCount ),

              author: {
                name: author_name,
                url: TEMPLATES.YT + author_url,
              }
            }
          }
          break

        case 'list':
          {
            const thumbnail = _jp.value( item, '$..thumbnail..url' )
            const title = (
              _jp.value( item, '$..title..text' ) ||
              _jp.value( item, '$..title..simpleText' )
            )

            const author_name = (
              _jp.value( item, '$..shortBylineText..text' ) ||
              _jp.value( item, '$..longBylineText..text' ) ||
              _jp.value( item, '$..shortBylineText..simpleText' ) ||
              _jp.value( item, '$..longBylineText..simpleTextn' )
            ) || 'YouTube'

            const author_url = (
              _jp.value( item, '$..shortBylineText..url' ) ||
              _jp.value( item, '$..longBylineText..url' )
            ) || ''

            const video_count = (
              _jp.value( item, '$..videoCountShortText..text' ) ||
              _jp.value( item, '$..videoCountText..text' ) ||
              _jp.value( item, '$..videoCountShortText..simpleText' ) ||
              _jp.value( item, '$..videoCountText..simpleText' ) ||
              _jp.value( item, '$..thumbnailText..text' ) ||
              _jp.value( item, '$..thumbnailText..simpleText' )
            )

            // url ( playlist )
            // const url = _jp.value( item, '$..navigationEndpoint..url' )
            const url = TEMPLATES.YT + '/playlist?list=' + listId

            result = {
              type: 'list',

              listId: listId,
              url: url,

              title: title.trim(),
              thumbnail: _normalizeThumbnail( thumbnail ),

              videoCount: video_count,

              author: {
                name: author_name,
                url: TEMPLATES.YT + author_url,
              }
            }
          }
          break

        case 'channel':
          {
            const thumbnail = _jp.value( item, '$..thumbnail..url' )
            const title = (
              _jp.value( item, '$..title..text' ) ||
              _jp.value( item, '$..title..simpleText' ) ||
              _jp.value( item, '$..displayName..text' )
            )

            const author_name = (
              _jp.value( item, '$..displayName..text' ) ||
              _jp.value( item, '$..displayName..simpleText' )
            )

            const video_count_label = (
              _jp.value( item, '$..videoCountText..text' ) ||
              _jp.value( item, '$..videoCountText..simpleText' )
            )

            let sub_count_label = (
              _jp.value( item, '$..subscriberCountText..text' ) ||
              _jp.value( item, '$..subscriberCountText..simpleText' )
            )

            // first space separated word that has digits
            if ( typeof sub_count_label === 'string' ) {
              sub_count_label = (
                sub_count_label.split( /\s+/ )
                .filter( function ( w ) { return w.match( /\d/ ) } )
              )[ 0 ]
            }

            // url ( playlist )
            // const url = _jp.value( item, '$..navigationEndpoint..url' )
            const url = (
              _jp.value( item, '$..navigationEndpoint..url' ) ||
              '/user/' + title
            )

            result = {
              type: 'channel',

              name: author_name,
              url: TEMPLATES.YT + url,

              title: title.trim(),
              thumbnail: _normalizeThumbnail( thumbnail ),

              videoCount: Number( video_count_label.replace( /\D+/g, '' ) ),
              videoCountLabel: video_count_label,

              subCountLabel: sub_count_label,
              subCount: _parseSubCountLabel( sub_count_label )
            }
          }
          break

        default:
      }

      if ( result ) {
        results.push( result )
      }
    } catch ( err ) {
      console.log( err )
      errors.push( err )
    }
  }

  debug( initialData )

  if ( errors.length ) {
    return callback( errors.pop(), results )
  }

  return callback( null, results )
}

function _normalizeThumbnail ( thumbnails )
{
  let t
  if ( typeof thumbnails === 'string' ) {
    t = thumbnails
  } else {
    // handle as array
    t = thumbnails[ 0 ]
  }

  if ( t.indexOf( '//' ) === 0 ) {
    return 'https://' + t.slice( 2 )
  }

  return t.split( 'http://' ).join( 'https://' )
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
    // console.log( qs )

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

  const description = $( '.yt-lockup-description', content ).text().trim()

  const metaInfo = $( '.yt-lockup-meta-info', content )
  const metaInfoList = $( 'li', metaInfo )

  const agoText = $( metaInfoList[ 0 ] ).text()
  const viewsText = $( metaInfoList[ 1 ] ).text()
  const viewsCount = Number( viewsText.split( ' ' )[ 0 ].split( ',' ).join( '' ).trim() )

  let channelId = ''
  let channelUrlText = ''

  let userId = ''
  let userUrlText = ''

  const user = $( 'a[href^="/user/"]', content )
  if ( user ) {
    userId = ( user.attr( 'href' ) || '' ).replace( '/user/', '' ).trim()
    userUrlText = user.text().trim() // is same as channel name?
  }

  const channel = $( 'a[href^="/channel/"]', content )
  if ( channel ) {
    channelId = ( channel.attr( 'href' ) || '' ).replace( '/channel/', '' ).trim()
    channelUrlText = channel.text().trim()
  }

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

    title: a.text().trim(),
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

/**
 * Parse result section of html containing a playlist result.
 *
 * @param {object} section - cheerio object
 */
function _parseListResult ( $, section ) {
  const content = $( '.yt-lockup-content', section )

  const h3 = $( '.yt-lockup-title', content )
  const h3_a = $( 'a', h3 )
  const title = h3_a.text().trim()

  const href = h3_a.attr( 'href' )
  const qs = _querystring.parse( href.split( '?', 2 )[ 1 ] )

  const listId = qs.list

  /* Playlist url's may have set the ?v= query string variable
   * to basically paly that specific video first when you open the
   * link ( and alos use that video's thumbnail as the thumbnail
   * for the playlist link.
   */
  const videoId = qs.v

  let channelId = ''
  let channelUrl = ''
  let channelUrlText = ''
  let userId = ''
  let userUrl = ''
  let userUrlText = ''

  const byline = $( '.yt-lockup-byline', content )
  const byline_a = $( 'a', byline )
  const byline_a_href = byline_a.attr( 'href' ) || ''

  if ( byline_a_href ) {
    // console.log( byline_a_href )

    if ( byline_a_href.indexOf( 'channel/' ) >= 0 ) {
      channelId = byline_a_href.split( '/' ).pop()
      channelUrl = 'https://youtube.com/channel/' + channelId
      channelUrlText = byline_a.text().trim()
    }

    if ( byline_a_href.indexOf( 'user/' ) >= 0 ) {
      userId = byline_a_href.split( '/' ).pop()
      userUrl = 'https://youtube.com/user/' + userId
      userUrlText = byline_a.text().trim()
    }
  } else {
    // likely that this is a playlist generated by YouTube
    // and not something created by a user/channel
    const byline_text = byline.text().trim()
    userUrlText = byline_text // probably "YouTube"
  }

  // channelName and userName are identical, just parsed
  // from different <a> elements
  const name = channelUrlText || userUrlText
  // console.log( name )

  const sidebar = $( '.sidebar', section )
  const videoCountLabel = sidebar.text().trim()
  const videoCount = Number( videoCountLabel.replace( /\D+/g, '' ) )

  const items = $( 'li.yt-lockup-playlist-item', content )

  // use for thumbnail
  const firstItem = $( 'a', items[ 0 ] )
  const firstItem_href = firstItem.attr( 'href' )
  const firstItem_qs = _querystring.parse(
    firstItem_href.split( '?', 2 )[ 1 ]
  )
  const firstItem_videoId = firstItem_qs.v

  // thumbnail video id
  const thumbId = ( videoId || firstItem_videoId )

  const thumbnailUrl = 'https://i.ytimg.com/vi/' + thumbId + '/default.jpg'
  const thumbnailUrlHQ = 'https://i.ytimg.com/vi/' + thumbId + '/hqdefault.jpg'

  // return result
  return {
    type: 'list',

    title: title,

    url: 'https://youtube.com/playlist?list=' + listId,
    listId: listId,

    // label is affected by language query string ( ex. ?hl=en )
    videoCountLabel: videoCountLabel,
    videoCount: videoCount,

    thumbnail: thumbnailUrl,
    image: thumbnailUrlHQ,

    author: {
      name: userUrlText || channelUrlText,

      // prefer userId's and url's as they are more user friendly
      // (newer channel id/url formats are cryptic)
      id: userId || channelId,
      url: userUrl || channelUrl,

      userId: userId,
      userUrl: userUrl,
      userName: userUrlText,

      channelId: channelId,
      channelUrl: channelUrl,
      channelName: channelUrlText
    }
  }
}

/**
 * Parse result section of html containing a channel result.
 *
 * @param {object} section - cheerio object
 */
function _parseChannelResult ( $, section ) {
  const img = $( 'img', section )
  const img_src = img.attr( 'src' )
  let thumbnailUrl = 'https:' + img_src

  const content = $( '.yt-lockup-content', section )

  const h3 = $( '.yt-lockup-title', content )
  const h3_a = $( 'a', h3 )
  const title = h3_a.text().trim()

  const href = h3_a.attr( 'href' ) || ''

  let channelId = ''
  let channelUrl = ''
  let channelUrlText = ''
  let userId = ''
  let userUrl = ''
  let userUrlText = ''
  if ( href.indexOf( 'channel/' ) >= 0 ) {
    channelId = href.split( '/' ).pop()
    channelUrl = 'https://youtube.com/channel/' + channelId
    channelUrlText = h3_a.text().trim()
  }
  if ( href.indexOf( 'user/' ) >= 0 ) {
    userId = href.split( '/' ).pop()
    userUrl = 'https://youtube.com/user/' + userId
    userUrlText = h3_a.text().trim()
  }

  const videoCountLabel = $( '.yt-lockup-meta-info', content ).text().trim()
  const videoCount = Number( videoCountLabel.replace( /\D+/g, '' ) )

  const description = $( '.yt-lockup-description', content ).text().trim()

  // return result
  return {
    type: 'channel',

    title: userUrlText || channelUrlText,
    description: description,

    url: userUrl || channelUrl,

    // label is affected by language query string ( ex. ?hl=en )
    videoCountLabel: videoCountLabel,
    videoCount: videoCount,

    thumbnail: thumbnailUrl,

    name: userUrlText || channelUrlText,
    id: userId || channelId,
    url:  userUrl || channelUrl,

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

function msToTimestamp ( ms )
{
  let t = ''

  const h = ms / ( 1000 * 60 * 60 )
  const m = ms / ( 1000 * 60 ) % 60
  const s = ms / ( 1000 * 60 * 60 ) % 60

  if ( h ) t += h + ':'
  if ( m ) t += m + ':'

  if ( String( s ).length < 2 ) t += '0'
  t += s

  return t
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
      if ( res.status !== 200 ) {
        return callback( 'http status: ' + res.status )
      }

      try {
        parseVideoBody( body, callback )
      } catch ( err ) {
        callback( err )
      }
    }
  } )
}

/* Get metadata from a playlist page
 */
function getPlaylistMetaData ( opts, callback )
{
  let listId

  if ( typeof opts === 'string' ) {
    listId = opts
  }

  if ( typeof opts === 'object' ) {
    listId = opts.listId || opts.playlistId
  }

  const uri = 'https://www.youtube.com/playlist?hl=en&list=' + listId

  const params = _url.parse( uri )

  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      if ( res.status !== 200 ) {
        return callback( 'http status: ' + res.status )
      }

      try {
        parsePlaylistBody( body, callback )
      } catch ( err ) {
        callback( err )
      }
    }
  } )
}

/* Parse response html from playlist url
 */
function parsePlaylistBody ( responseText, callback )
{
  const $ = _cheerio.load( responseText )

  const hti = $( '.pl-header-thumb img' )
  const thumbnailUrl = hti.attr( 'src' ).split( '?', 2 )[ 0 ]

  const headerContent = $( '.pl-header-content' )
  const title = $( '.pl-header-title', headerContent ).text().trim()

  const listId = $( '#pl-header' ).attr( 'data-full-list-id' )

  const headerDetails = $( '.pl-header-details', headerContent )
  const detailLi = $( 'li', headerDetails )

  const author = _parseAuthorAnchorTag( $( 'a', detailLi[ 0 ] ) )

  const videoCountLabel = $( detailLi[ 1 ] ).text().trim()
  const videoCount = Number( videoCountLabel.replace( /\D+/g, '' ) )

  const viewCountLabel = $( detailLi[ 2 ] ).text().trim()
  const viewCount = Number( viewCountLabel.replace( /\D+/g, '' ) )

  const lastUpdateLabel = $( detailLi[ 3 ] ).text().trim()
  const lastUpdate = _parsePlaylistLastUpdateTime( lastUpdateLabel )

  const items = $( '#pl-load-more-destination .pl-video' )

  const list = []
  for ( let i = 0; i < items.length; i++ ) {
    const item = items[ i ]
    const title = $( item ).attr( 'data-title' )

    const videoId = $( item ).attr( 'data-video-id' )
    const videoUrl = `https://youtube.com/watch?v=${ videoId }&list=${ listId }`

    const thumbnailUrl = 'https://i.ytimg.com/vi/' + videoId + '/default.jpg'
    const thumbnailUrlHQ = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'

    const anchorTag = $( '.pl-video-owner a', item )
    const author = _parseAuthorAnchorTag( anchorTag )

    list.push( {
      title: title,

      videoId: videoId,
      listId: listId,

      url: videoUrl,

      thumbnailUrl: thumbnailUrl,
      thumbnailUrlHQ: thumbnailUrlHQ,

      owner: author.name,

      author: author
    } )
  }

  const playlist = {
    title: title,
    listId: listId,

    url: 'https://www.youtube.com/playlist?hl=en&list=' + listId,

    videoCount: videoCount,
    views: Number( viewCount ),
    lastUpdate: lastUpdate,

    thumbnail: thumbnailUrl,

    // playlist items/videos
    items: list,

    author: author
  }

  callback( null, playlist )
}

/**
 * @params {object} - cheerio <a>...</a> tag
 */
function _parseAuthorAnchorTag ( a ) {
  let channelId = ''
  let channelUrl = ''
  let channelUrlText = ''

  let userId = ''
  let userUrl = ''
  let userUrlText = ''

  const href = a.attr( 'href' )

  if ( !href ) {
    return {}
  }

  if ( href.indexOf( 'channel/' ) >= 0 ) {
    channelId = href.split( '/' ).pop()
    channelUrl = 'https://youtube.com/channel/' + channelId
    channelUrlText = a.text().trim()
  }

  if ( href.indexOf( 'user/' ) >= 0 ) {
    userId = href.split( '/' ).pop()
    userUrl = 'https://youtube.com/user/' + userId
    userUrlText = a.text().trim()
  }

  return {
    name: userUrlText || channelUrlText,
    id: userId || channelId,
    url: userUrl || channelUrl,

    channelId,
    channelUrl,
    channelUrlText,

    userId,
    userUrl,
    userUrlText,
  }
}

function _parsePlaylistLastUpdateTime ( lastUpdateLabel ) {
  // ex "Last Updated on Jun 25, 2018"
  // ex: "Viimeksi päivitetty 25.6.2018"

  const words = lastUpdateLabel.trim().split( /[\s.-]+/ )

  for ( let i = 0; i < words.length; i++ ) {
    const slice = words.slice( i )
    const t = slice.join( ' ' )
    const r = slice.reverse().join( ' ' )

    const a = new Date( t )
    const b = new Date( r )

    if ( a.toString() !== 'Invalid Date' )  return _toInternalDateString( a )
    if ( b.toString() !== 'Invalid Date' )  return _toInternalDateString( b )
  }

  return ''
}

function _toInternalDateString ( date ) {
  return (
    date.getUTCFullYear() + '-' +
    date.getUTCMonth() + '-' +
    date.getUTCDate()
  )
}

function parseVideoBody ( responseText, callback )
{
  const $ = _cheerio.load( responseText )

  const ctx = $( '#content' )

  const videoId = $('meta[itemprop=videoId]', ctx ).attr( 'content' )

  if ( !videoId ) {
    return callback( 'video unavailable' )
  }

  let channelId = ''
  let channelUrl = ''
  let channelUrlText = ''

  let userId = ''
  let userUrl = ''
  let userUrlText = ''

  let userName = ''
  let channelName = ''

  const user = $( 'link[href*="/user/"]', ctx ) || $( 'a[href*="/user/"]' )

  if ( user ) {
    const user_href = user.attr( 'href' ) || ''
    if ( user_href ) {
      userId = user_href.split( '/' ).pop()
      userUrl = 'https://youtube.com/user/' + userId
    }
  }

  userName = $( '.yt-user-info a' ).text().trim()

  const channel = $( 'link[href*="/channel/"]', ctx ) || $( 'a[href*="/channel/"' )
  channelId = $( 'meta[itemprop=channelId]', ctx ).attr( 'content' )
  channelUrl = 'https://youtube.com/channel/' + channelId

  if ( channel ) {
    const channel_href = channel.attr( 'href' ) || ''
    if ( channel_href ) {
      channelId = channel_href.split( '/' ).pop()
      channelUrl = 'https://youtube.com/channel/' + channelId
    }
  }

  const thumbnailUrl = 'https://i.ytimg.com/vi/' + videoId + '/default.jpg'
  const thumbnailUrlHQ = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'

  // use schema json if found
  const person = $( 'script[type="application/ld+json"]' ).text()
  try {
    const personJSON = JSON.parse( person )
    channelName = personJSON.itemListElement[ 0 ].item.name
  } catch ( err ) {
    // ignore
  }

  let duration = ''
  const humanDuration = $( 'meta[itemprop=duration]', ctx ).attr( 'content' )

  if ( humanDuration ) {
    duration = parseHumanDuration( humanDuration )
  }

  if ( !duration ) {
    const m = responseText.match( /approxDurationMs.*?(\d+)/ )
    if ( m && m[ 1 ] ) {
      const ms = m[ 1 ]
      const timestamp = msToTimestamp( ms )
      duration = parseDuration( timestamp )
    }
  }


  const uploadDate = $('meta[itemprop=uploadDate]', ctx ).attr( 'content' )

  const video = {
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

  callback( null, video )
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
  test( 'superman theme list' )
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

    playlists.forEach( function ( p ) {
      // console.log( p )
    } )
  } )
}
