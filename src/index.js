const _cheerio = require( 'cheerio' )
const _dasu = require( 'dasu' )
const _parallel = require( 'async.parallellimit' )

// auto follow off
_dasu.follow = false
_dasu.debug = false

const _jp = require( 'jsonpath' )

// google bot user-agent
// Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)

// use fixed user-agent to get consistent html page documents as
// it varies depending on the user-agent
// the string "Googlebot" seems to give us pages without
// warnings to update our browser, which is why we keep it in
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) (yt-search; https://www.npmjs.com/package/yt-search)'

let _userAgent = DEFAULT_USER_AGENT // mutable global user-agent

const _url = require( 'url' )

const _envs = {}
Object.keys( process.env ).forEach(
  function ( key ) {
    const n = process.env[ key ]
    if ( n == '0' || n == 'false' || !n ) {
      return _envs[ key ] = false
    }
    _envs[ key ] = n
  }
)

const _debugging = _envs.debug

function debug () {
  if ( !_debugging ) return
  console.log.apply( this, arguments )
}

// used to escape query strings
const _querystring = require( 'querystring' )

const _humanTime = require( 'human-time' )

const TEMPLATES = {
  YT: 'https://youtube.com',
  SEARCH_MOBILE: 'https://m.youtube.com/results',
  SEARCH_DESKTOP: 'https://www.youtube.com/results'
}

const ONE_SECOND = 1000
const ONE_MINUTE = ONE_SECOND * 60
const TIME_TO_LIVE = ONE_MINUTE * 5

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

  // override userAgent if set ( not recommended )
  if ( _options.userAgent ) _userAgent = _options.userAgent

  // support common alternatives ( mutates )
  _options.search = _options.query || _options.search

  // initial search text ( _options.search is mutated )
  _options.original_search = _options.search

  // ignore query, only get metadata from specific video id
  if ( _options.videoId ) {
    return getVideoMetaData( _options.videoId, callback )
  }

  // ignore query, only get metadata from specific playlist id
  if ( _options.listId ) {
    return getPlaylistMetaData( _options.listId, callback )
  }

  if ( !_options.search ) {
    return callback( Error( 'yt-search: no query given' ) )
  }

  work()

  function work () {
    getSearchResults( _options, callback )
  }
}

function _videoFilter ( video, index, videos )
{
  if ( video.type !== 'video' ) return false

  // filter duplicates
  const videoId = video.videoId

  const firstIndex = videos.findIndex( function ( el ) {
    return ( videoId === el.videoId )
  } )

  return ( firstIndex === index )
}

function _playlistFilter ( result, index, results )
{
  if ( result.type !== 'list' ) return false

  // filter duplicates
  const id = result.listId

  const firstIndex = results.findIndex( function ( el ) {
    return ( id === el.listId )
  } )

  return ( firstIndex === index )
}

function _channelFilter ( result, index, results )
{
  if ( result.type !== 'channel' ) return false

  // filter duplicates
  const url = result.url

  const firstIndex = results.findIndex( function ( el ) {
    return ( url === el.url )
  } )

  return ( firstIndex === index )
}

function _liveFilter ( result, index, results )
{
  if ( result.type !== 'live' ) return false

  // filter duplicates
  const videoId = result.videoId

  const firstIndex = results.findIndex( function ( el ) {
    return ( videoId === el.videoId )
  } )

  return ( firstIndex === index )
}

/* Request search page results with provided
 * search_query term
 */
function getSearchResults ( _options, callback )
{
  // querystring variables
  const q = _querystring.escape( _options.search ).split( /\s+/ )
  const hl = _options.hl || 'en'
  const gl = _options.gl || 'US'
  const category = _options.category || '' // music

  let pageStart = (
    Number( _options.pageStart ) || 1
  )

  let pageEnd = (
    Number( _options.pageEnd ) ||
    Number( _options.pages ) || 1
  )

  // handle zero-index start
  if ( pageStart <= 0 ) {
    pageStart = 1
    if ( pageEnd >= 1 ) {
      pageEnd += 1
    }
  }

  if ( Number.isNaN( pageEnd ) ) {
    callback( 'error: pageEnd must be a number' )
  }

  _options.pageStart = pageStart
  _options.pageEnd = pageEnd
  _options.currentPage = _options.currentPage || pageStart

  let queryString = '?'
  queryString += 'search_query=' + q.join( '+' )

  // language
  // queryString += '&'
  if ( queryString.indexOf( '&hl=' ) === -1 ) {
    queryString += '&hl=' + hl
  }

  // location
  // queryString += '&'
  if ( queryString.indexOf( '&gl=' ) === -1 ) {
    queryString += '&gl=' + gl
  }

  if ( category ) { // ex. "music"
    queryString += '&category=' + category
  }

  if ( _options.sp ) {
    queryString += '&sp=' + _options.sp
  }

  const uri = TEMPLATES.SEARCH_DESKTOP + queryString

  const params = _url.parse( uri )

  params.headers = {
    'user-agent': _userAgent,
    'accept': 'text/html',
    'accept-encoding': 'gzip',
    'accept-language': 'en-US'
  }

  debug( params )

  debug( 'getting results: ' + _options.currentPage )
  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      if ( res.status !== 200 ) {
        return callback( 'http status: ' + res.status )
      }

      if ( _debugging ) {
        const fs = require( 'fs' )
        const path = require( 'path' )
        fs.writeFileSync( 'dasu.response', res.responseText, 'utf8' )
      }

      try {
        _parseSearchResultInitialData( body, function ( err, results ) {
          if ( err ) return callback( err )

          const list = results

          const videos = list.filter( _videoFilter )
          const playlists = list.filter( _playlistFilter )
          const channels = list.filter( _channelFilter )
          const live = list.filter( _liveFilter )

          // keep saving results into temporary memory while
          // we get more results
          _options._data = _options._data || {}

          // init memory
          _options._data.videos = _options._data.videos || []
          _options._data.playlists = _options._data.playlists || []
          _options._data.channels = _options._data.channels || []
          _options._data.live = _options._data.live || []

          // push received results into memory
          videos.forEach( function ( item ) {
            _options._data.videos.push( item )
          } )
          playlists.forEach( function ( item ) {
            _options._data.playlists.push( item )
          } )
          channels.forEach( function ( item ) {
            _options._data.channels.push( item )
          } )
          live.forEach( function ( item ) {
            _options._data.live.push( item )
          } )

          _options.currentPage++
          const getMoreResults = (
            _options.currentPage <= _options.pageEnd
          )

          if ( getMoreResults && results._sp ) {
            _options.sp = results._sp

            setTimeout( function () {
              getSearchResults( _options, callback )
            }, 2500 ) // delay a bit to try and prevent throttling
          } else {
            const videos = _options._data.videos.filter( _videoFilter )
            const playlists = _options._data.playlists.filter( _playlistFilter )
            const channels = _options._data.channels.filter( _channelFilter )
            const live = _options._data.live.filter( _liveFilter )

            // return all found videos
            callback( null, {
              videos: videos,

              live: live,

              playlists: playlists,
              lists: playlists,

              accounts: channels,
              channels: channels
            } )
          }
        } )
      } catch ( err ) {
        callback( err )
      }
    }
  } )
}

/* For "modern" user-agents the html document returned from
 * YouTube contains initial json data that is used to populate
 * the page with JavaScript. This function will aim to find and
 * parse such data.
 */
function _parseSearchResultInitialData ( responseText, callback )
{
  const re = /{.*}/
  const $ = _cheerio.load( responseText )

  let initialData = $( 'div#initial-data' ).html() || ''
  initialData = re.exec( initialData ) || ''

  if ( !initialData ) {
    const scripts = $( 'script' )

    for ( let i = 0; i < scripts.length; i++ ) {
      const script = $( scripts[ i ] ).html()

      const lines = script.split( '\n' )
      lines.forEach( function ( line ) {
        let i
        while ( ( i = line.indexOf( 'ytInitialData' ) ) >= 0 ) {
          line = line.slice( i + 'ytInitialData'.length )
          const match = re.exec( line )
          if ( match && match.length > initialData.length ) {
            initialData = match
          }
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

    const hasList = ( item.compactPlaylistRenderer || item.playlistRenderer )
    const hasChannel = ( item.compactChannelRenderer || item.channelRenderer )
    const hasVideo = ( item.compactVideoRenderer || item.videoRenderer )

    const listId = hasList && ( _jp.value( item, '$..playlistId' ) )
    const channelId = hasChannel && ( _jp.value( item, '$..channelId' ) )
    const videoId = hasVideo && ( _jp.value( item, '$..videoId' ) )

    const watchingLabel = ( _jp.query( item, '$..viewCountText..text' ) ).join( '' )
    const isLive = watchingLabel.indexOf( 'watching' ) >= 0

    if ( videoId ) {
      type = 'video'
    }

    if ( channelId ) {
      type = 'channel'
    }

    if ( listId ) {
      type = 'list'
    }

    if ( isLive ) {
      type = 'live'
    }

    try {
      switch ( type ) {
        case 'video':
          {
            const thumbnail = (
              _normalizeThumbnail( _jp.value( item, '$..thumbnail..url' ) ) ||
              _normalizeThumbnail( _jp.value( item, '$..thumbnails..url' ) ) ||
              _normalizeThumbnail( _jp.value( item, '$..thumbnails' ) )
            )

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
              _jp.value( item, '$..publishedTimeText..text' ) ||
              _jp.value( item, '$..publishedTimeText..simpleText' )
            )

            const viewCountText = (
              _jp.value( item, '$..viewCountText..text' ) ||
              _jp.value( item, '$..viewCountText..simpleText' ) || "0"
            )

            const viewsCount = Number( viewCountText.split( /\s+/ )[ 0 ].split( /[,.]/ ).join( '' ).trim() )

            const lengthText = (
              _jp.value( item, '$..lengthText..text' ) ||
              _jp.value( item, '$..lengthText..simpleText' )
            )
            const duration = _parseDuration( lengthText || '0:00' )

            const description = (
              ( _jp.query( item, '$..description..text' ) ).join( '' ) ||
              ( _jp.query( item, '$..descriptionSnippet..text' ) ).join( '' )
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

              image: thumbnail,
              thumbnail: thumbnail,

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
            const thumbnail = (
              _normalizeThumbnail( _jp.value( item, '$..thumbnail..url' ) ) ||
              _normalizeThumbnail( _jp.value( item, '$..thumbnails..url' ) ) ||
              _normalizeThumbnail( _jp.value( item, '$..thumbnails' ) )
            )

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

              image: thumbnail,
              thumbnail: thumbnail,

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
            const thumbnail = (
              _normalizeThumbnail( _jp.value( item, '$..thumbnail..url' ) ) ||
              _normalizeThumbnail( _jp.value( item, '$..thumbnails..url' ) ) ||
              _normalizeThumbnail( _jp.value( item, '$..thumbnails' ) )
            )

            const title = (
              _jp.value( item, '$..title..text' ) ||
              _jp.value( item, '$..title..simpleText' ) ||
              _jp.value( item, '$..displayName..text' )
            )

            const author_name = (
              _jp.value( item, '$..shortBylineText..text' ) ||
              _jp.value( item, '$..longBylineText..text' ) ||
              _jp.value( item, '$..displayName..text' ) ||
              _jp.value( item, '$..displayName..simpleText' )
            )

            const video_count_label = (
              _jp.value( item, '$..videoCountText..text' ) ||
              _jp.value( item, '$..videoCountText..simpleText' ) || '0'
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

              image: thumbnail,
              thumbnail: thumbnail,

              videoCount: Number( video_count_label.replace( /\D+/g, '' ) ),
              videoCountLabel: video_count_label,

              subCount: _parseSubCountLabel( sub_count_label ),
              subCountLabel: sub_count_label
            }
          }
          break

        case 'live':
          {
            const thumbnail = (
              _normalizeThumbnail( _jp.value( item, '$..thumbnail..url' ) ) ||
              _normalizeThumbnail( _jp.value( item, '$..thumbnails..url' ) ) ||
              _normalizeThumbnail( _jp.value( item, '$..thumbnails' ) )
            )

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

            const watchingLabel = (
              ( _jp.query( item, '$..viewCountText..text' ) ).join( '' ) ||
              ( _jp.query( item, '$..viewCountText..simpleText' ) ).join( '' ) || '0'
            )

            const watchCount = Number( watchingLabel.split( /\s+/ )[ 0 ].split( /[,.]/ ).join( '' ).trim() )

            const description = (
              ( _jp.query( item, '$..description..text' ) ).join( '' ) ||
              ( _jp.query( item, '$..descriptionSnippet..text' ) ).join( '' )
            )

            // url ( playlist )
            // const url = _jp.value( item, '$..navigationEndpoint..url' )
            const url = TEMPLATES.YT + '/watch?v=' + videoId

            result = {
              type: 'live',

              videoId: videoId,
              url: url,

              title: title.trim(),
              description: description,

              image: thumbnail,
              thumbnail: thumbnail,

              watching: Number( watchCount ),

              author: {
                name: author_name,
                url: TEMPLATES.YT + author_url,
              }
            }
          }
          break

        default:
          // ignore other stuff
      }

      if ( result ) {
        results.push( result )
      }
    } catch ( err ) {
      debug( err )
      errors.push( err )
    }
  }

  const ctoken = _jp.value( json, '$..continuation' )
  results._ctoken = ctoken

  if ( errors.length ) {
    return callback( errors.pop(), results )
  }

  return callback( null, results )
}

/* Get metadata of a single video
 */
function getVideoMetaData ( opts, callback )
{
  debug( 'fn: getVideoMetaData' )

  let videoId

  if ( typeof opts === 'string' ) {
    videoId = opts
  }

  if ( typeof opts === 'object' ) {
    videoId = opts.videoId
  }

  const uri = 'https://www.youtube.com/watch?hl=en&gl=US&v=' + videoId

  const params = _url.parse( uri )

  params.headers = {
    'user-agent': _userAgent,
    'accept': 'text/html',
    'accept-encoding': 'gzip',
    'accept-language': 'en-US'
  }

  params.headers[ 'user-agent' ] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15'

  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      if ( res.status !== 200 ) {
        return callback( 'http status: ' + res.status )
      }

      if ( _debugging ) {
        const fs = require( 'fs' )
        const path = require( 'path' )
        fs.writeFileSync( 'dasu.response', res.responseText, 'utf8' )
      }

      try {
        _parseVideoInitialData( body, callback )
      } catch ( err ) {
        callback( err )
      }
    }
  } )
}

function _parseVideoInitialData ( responseText, callback )
{
  debug( '_parseVideoInitialData' )

  // const fs = require( 'fs' )
  // fs.writeFileSync( 'tmp.file', responseText )

  const initialData = _between(
    _fineLine( /ytInitialData.*=\s*{/, responseText ), '{', '}'
  )

  if ( !initialData ) {
    return callback( 'could not find inital data in the html document' )
  }

  const initialPlayerData = _between(
    _fineLine( /ytInitialPlayerResponse.*=\s*{/, responseText ), '{', '}'
  )

  if ( !initialPlayerData ) {
    return callback( 'could not find inital player data in the html document' )
  }

  // debug( initialData[ 0 ] )
  // debug( '\n------------------\n' )
  // debug( initialPlayerData[ 0 ] )

  const idata = JSON.parse( initialData )
  const ipdata = JSON.parse( initialPlayerData )

  const videoId = _jp.value( idata, '$..currentVideoEndpoint..videoId' )

  if ( !videoId ) {
    return callback( 'video unavailable' )
  }

  if (
    _jp.value( ipdata, '$..status' ) === 'ERROR' ||
    _jp.value( ipdata, '$..reason' ) === 'Video unavailable'
  ) {
    return callback( 'video unavailable' )
  }

  const title = (
    _jp.value( idata, '$..videoPrimaryInfoRenderer..title..text' ) ||
    _jp.value( idata, '$..videoPrimaryInfoRenderer..title..simpleText' ) ||
    _jp.value( idata, '$..videoPrimaryRenderer..title..text' ) ||
    _jp.value( idata, '$..videoPrimaryRenderer..title..simpleText' ) ||
    _jp.value( idata, '$..title..text' ) ||
    _jp.value( idata, '$..title..simpleText' )
  )

  const description = (
    ( _jp.query( idata, '$..description..text' ) ).join( '' ) ||
    ( _jp.query( ipdata, '$..description..simpleText' ) ).join( '' ) ||
    ( _jp.query( ipdata, '$..microformat..description..simpleText' ) ).join( '' ) ||
    ( _jp.query( ipdata, '$..videoDetails..shortDescription' ) ).join( '' )
  )

  const author_name = (
    _jp.value( idata, '$..owner..title..text' ) ||
    _jp.value( idata, '$..owner..title..simpleText' )
  )

  const author_url = (
    _jp.value( idata, '$..owner..navigationEndpoint..url' ) ||
    _jp.value( idata, '$..owner..title..url' )
  )

  const thumbnailUrl = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'

  const seconds = Number(
    _jp.value( ipdata, '$..videoDetails..lengthSeconds' )
  )

  const timestamp = _msToTimestamp( seconds * 1000 )

  const duration = _parseDuration( timestamp )

  const sentimentBar = (
    // ex. "tooltip": "116,701 / 8,930"
    _jp.value( idata, '$..sentimentBar..tooltip' )
    .split( /[,.]/ ).join( '' )
    .split( /\D+/ )
  )

  const likes = Number( sentimentBar[ 0 ] )
  const dislikes = Number( sentimentBar[ 1 ] )

  const uploadDate = (
    _jp.value( idata, '$..uploadDate' ) ||
    _jp.value( idata, '$..dateText..simpleText' )
  )

  const agoText = uploadDate && _humanTime( new Date( uploadDate ) ) || ''

  const video = {
    title: title,
    description: description,

    url: TEMPLATES.YT + '/watch?v=' + videoId,
    videoId: videoId,

    seconds: Number( duration.seconds ),
    timestamp: duration.timestamp,
    duration: duration,

    views: Number(
      _jp.value( ipdata, '$..videoDetails..viewCount' )
    ),

    genre: ( _jp.value( ipdata, '$..category' ) || '' ).toLowerCase(),

    uploadDate: _toInternalDateString( uploadDate ),
    ago: agoText, // ex: 10 years ago

    image: thumbnailUrl,
    thumbnail: thumbnailUrl,

    author: {
      name: author_name,
      url: TEMPLATES.YT + author_url
    }
  }

  callback( null, video )
}

/* Get metadata from a playlist page
 */
function getPlaylistMetaData ( opts, callback )
{
  debug( 'fn: getPlaylistMetaData' )

  let listId

  if ( typeof opts === 'string' ) {
    listId = opts
  }

  if ( typeof opts === 'object' ) {
    listId = opts.listId || opts.playlistId
  }

  const uri = (
    'https://www.youtube.com/playlist?hl=en&gl=US&list=' + listId
  )

  const params = _url.parse( uri )

  params.headers = {
    'user-agent': _userAgent,
    'accept': 'text/html',
    'accept-encoding': 'gzip',
    'accept-language': 'en-US'
  }

  _dasu.req( params, function ( err, res, body ) {
    if ( err ) {
      callback( err )
    } else {
      if ( res.status !== 200 ) {
        return callback( 'http status: ' + res.status )
      }

      if ( _debugging ) {
        const fs = require( 'fs' )
        const path = require( 'path' )
        fs.writeFileSync( 'dasu.response', res.responseText, 'utf8' )
      }

      try {
        _parsePlaylistInitialData( body, callback )
      } catch ( err ) {
        callback( err )
      }
    }
  } )
}

function _parsePlaylistInitialData ( responseText, callback )
{
  debug( 'fn: parsePlaylistBody' )

  const jsonString = responseText.match( /ytInitialData.*=\s*({.*});/ )[ 1 ]

  // console.log( jsonString )

  if ( !jsonString ) {
    throw new Error( 'failed to parse ytInitialData json data' )
  }

  let json = JSON.parse( jsonString )
  //console.log( json )

  // TODO parse relevant json data with jsonpath
  const listId = ( _jp.value( json, '$..microformat..urlCanonical' ) ).split( '=' )[ 1 ]
  // console.log( 'listId: ' + listId )

  const viewCount = _jp.value( json, '$..sidebar.playlistSidebarRenderer.items[0]..stats[1].simpleText' ).match( /\d+/ )
  // console.log( 'viewCount: ' + viewCount )

  const list = _jp.query( json, '$..contents..tabs[0]..contents[0]..contents[0]..contents' )[ 0 ]
  const videos = []

  list.forEach( function ( playlistVideoRenderer ) {
    const json = playlistVideoRenderer
    const video = {
      title: _jp.value( json, '$..title..simpleText' ),

      videoId: _jp.value( json, '$..videoId' ),
      listId: listId,

      thumbnail:  _jp.value( json, '$..thumbnail..thumbnails[0]..url' ).split( '?' )[ 0 ],

      author: {
        name: _jp.value( json, '$..shortBylineText..runs[0]..text' ),
        url: 'https://youtube.com' + _jp.value( json, '$..shortBylineText..runs[0]..url' ),
      }
    }

    videos.push( video )
  } )

  // console.log( videos )
  // console.log( 'videos.length: ' + videos.length )

  const playlist = {
    title: _jp.value( json, '$..microformat..title' ),
    listId: listId,

    url: 'https://youtube.com/playlist?list=' + listId,

    views: Number( viewCount ),

    // lastUpdate: lastUpdate,
    date: _parsePlaylistLastUpdateTime(
      _jp.value( json, '$..sidebar.playlistSidebarRenderer.items[0]..stats[2]..simpleText' )
    ),

    image: videos[ 0 ].thumbnail,
    thumbnail: videos[ 0 ].thumbnail,

    // playlist items/videos
    videos: videos,

    author: {
      name: _jp.value( json, '$..videoOwner..title..runs[0]..text' ),
      url: 'https://youtube.com' + _jp.value( json, '$..videoOwner..navigationEndpoint..url' )
    }
  }

  callback && callback( null, playlist )
}

function _parsePlaylistLastUpdateTime ( lastUpdateLabel ) {
  debug( 'fn: _parsePlaylistLastUpdateTime' )

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
  debug( 'fn: _toInternalDateString' )

  return (
    date.getFullYear() + '-' +
    date.getMonth() + '-' +
    date.getDate()
  )
}

/* Helper fn to parse duration labels
 * ex: Duration: 2:27, Kesto: 1.07.54
 */
function _parseDuration ( timestampText )
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

/* Parses a type of human-like timestamps found on YouTube.
 * ex: "PT4M13S" -> "4:13"
 */
function _parseHumanDuration ( timestampText )
{
  debug( '_parseHumanDuration' )

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

/* Helper fn to parse sub count labels
 * and turn them into Numbers.
 *
 * It's an estimate but can be useful for sorting etc.
 *
 * ex. "102M subscribers" -> 102000000
 */
function _parseSubCountLabel ( subCountLabel )
{
  if ( !subCountLabel ) return undefined

  const label = (
    subCountLabel.split( /\s+/ )
    .filter( function ( w ) { return w.match( /\d/ ) } )
  )[ 0 ].toLowerCase()

  const num = Number( label.replace( /\D/g, '' ) )

  const THOUSAND = 1000
  const MILLION = THOUSAND * THOUSAND

  if ( label.indexOf( 'm' ) >= 0 ) return MILLION * num
  if ( label.indexOf( 'k' ) >= 0 ) return THOUSAND * num
  return num
}

/* Helper fn to choose a good thumbnail.
 */
function _normalizeThumbnail ( thumbnails )
{
  let t
  if ( typeof thumbnails === 'string' ) {
    t = thumbnails
  } else {
    // handle as array
    if ( thumbnails.length ) {
      t = thumbnails[ 0 ]
      return _normalizeThumbnail( t )
    }

    // failed to parse thumbnail
    return undefined
  }

  t = t.split( '?' )[ 0 ]

  t = t.split( '/default.jpg' ).join( '/hqdefault.jpg' )
  t = t.split( '/default.jpeg' ).join( '/hqdefault.jpeg' )

  if ( t.indexOf( '//' ) === 0 ) {
    return 'https://' + t.slice( 2 )
  }

  return t.split( 'http://' ).join( 'https://' )
}

/* Helper fn to transform ms to timestamp
 * ex: 253000 -> "4:13"
 */
function _msToTimestamp ( ms )
{
  let t = ''

  const MS_HOUR = 1000 * 60 * 60
  const MS_MINUTE = 1000 * 60
  const MS_SECOND = 1000

  const h = Math.floor( ms / MS_HOUR )
  const m = Math.floor( ms / MS_MINUTE ) % 60
  const s = Math.floor( ms / MS_SECOND ) % 60

  if ( h ) t += h + ':'
  if ( m ) t += m + ':'

  if ( String( s ).length < 2 ) t += '0'
  t += s

  return t
}

// run tests is script is run directly
if ( require.main === module ) {
  // https://www.youtube.com/watch?v=e9vrfEoc8_g
  test( 'superman theme list pewdiepie channel' )
}

function test ( query )
{
  console.log( 'test: doing list search' )

  const opts = {
    query: query,
    pageEnd: 1
  }

  search( opts, function ( error, r ) {
    if ( error ) throw error

    const videos = r.videos
    const playlists = r.playlists
    const channels = r.channels

    console.log( 'videos: ' + videos.length )
    console.log( 'playlists: ' + playlists.length )
    console.log( 'channels: ' + channels.length )

    for ( let i = 0; i < videos.length; i++ ) {
      const song = videos[ i ]
      const time = ` (${ song.timestamp })`
      console.log( song.title + time )
    }

    playlists.forEach( function ( p ) {
      console.log( `playlist: ${ p.title } | ${ p.listId }` )
    } )

    channels.forEach( function ( c ) {
      console.log( `channel: ${ c.title } | ${ c.description }` )
    } )
  } )
}

function _fineLine ( regex, text ) {
  const cache = _fineLine.cache || {}
  _fineLine.cache = cache

  cache[ text ] = cache[ text ] || {}

  const lines = cache[ text ].lines || text.split( '\n' )
  cache[ text ].lines = lines

  clearTimeout( cache[ text ].timeout )
  cache[ text ].timeout = setTimeout( function () {
    delete cache[ text ]
  }, 100 )

  for ( let i = 0; i < lines.length; i++ ) {
    const line = lines[ i ]
    if ( regex.test( line ) ) return line
  }

  return ''
}

function _between ( text, start, end ) {
  let i = text.indexOf( start )
  let j = text.lastIndexOf( end )
  if ( i < 0 ) return ''
  if ( j < 0 ) return ''
  return text.slice( i, j + 1 )
}
