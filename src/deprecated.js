// all of these fn's DEPRECATED/EXPERIMENTAL

/* The document returned by YouTube is may be
 * different depending on the user-agent header.
 * Seems like the mobile uri versions and modern user-agents
 * get served html documents with continuation tokens (ctoken)
 * that are used to get more page results when you scroll down
 * on the page.
 * We will be using these ctokens as our strategy to get more
 * video results in this function.
 * getDesktopVideos will be using an older strategy to get
 * more video results.
 *
 * DEPRECATED!
 *
 * The initial data of video resulsts provided for mobiles
 * lack certain information such as video description snippets.
 * I've decided not to parse mobile sites and instead attempt to
 * GET desktop documents with more information to parse by
 * settings desktop-like user-agents and using desktop url's.
 */
function getMobileVideos ( _options, callback )
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

  params.headers = {
    'user-agent': _userAgent,
    'accept': 'text/html'
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
        parseInitialData( body, function ( err, results ) {
          if ( err ) return callback( err )

          const list = results

          const videos = list.filter( videoFilter )
          const playlists = list.filter( playlistFilter )
          const channels = list.filter( channelFilter )

          callback( null, {
            videos: videos,

            playlists: playlists,
            lists: playlists,

            accounts: channels,
            channels: channels
          } )
        } )
      } catch ( err ) {
        callback( err )
      }
    }
  } )
}

/* The page results received on Desktop urls vary by user-agent.
 * Some are given older static versions while some get newer
 * versions with embedded initial json data.
 *
 * We will target modern pages (using modern user-agent headers)
 * with embedded json data and parse them in this function.
 */
function getDesktopVideos ( _options, callback )
{
  // querystring variables
  const q = _querystring.escape( _options.query ).split( /\s+/ )
  const hl = _options.hl || 'en'
  const gl = _options.gl || 'US'
  const category = _options.category || '' // music

  const pageStart = 1
  const pageEnd = Number( _options.pageEnd ) || 1

  if ( Number.isNaN( pageEnd ) ) {
    callback( 'error: pageEnd must be a number' )
  }

  _options.pageStart = pageStart
  _options.pageEnd = pageEnd
  _options.currentPage = _options.currentPage || pageStart

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

  if ( _options.ctoken ) { // ex. "music"
    queryString += '&'
    queryString += '&ctoken=' + _options.ctoken
  }

  const uri = TEMPLATES.SEARCH_DESKTOP + queryString

  const params = _url.parse( uri )

  params.headers = {
    'user-agent': _userAgent,
    'accept': 'text/html',
    'accept-encoding': 'gzip',
    'accept-language': 'en-US,en-GB'
  }

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
        parseInitialData( body, function ( err, results ) {
          if ( err ) return callback( err )

          const list = results

          const videos = list.filter( videoFilter )
          const playlists = list.filter( playlistFilter )
          const channels = list.filter( channelFilter )

          // keep saving results into temporary memory while
          // we get more results
          _options._data = _options._data || {}

          // init memory
          _options._data.videos = _options._data.videos || []
          _options._data.playlists = _options._data.playlists || []
          _options._data.channels = _options._data.channels || []

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

          _options.currentPage++
          const getMoreResults = (
            _options.currentPage <= _options.pageEnd
          )

          if ( getMoreResults && results._ctoken ) {
            _options.ctoken = results._ctoken

            setTimeout( function () {
              getDesktopVideos( _options, callback )
            }, 3000 ) // delay a bit to try and prevent throttling
          } else {
            const videos = _options._data.videos.filter( videoFilter )
            const playlists = _options._data.playlists.filter( playlistFilter )
            const channels = _options._data.channels.filter( channelFilter )

            // return all found videos
            callback( null, {
              videos: videos,

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
function parseInitialData ( responseText, callback )
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

    if ( videoId ) {
      type = 'video'
    }

    if ( channelId ) {
      type = 'channel'
    }

    if ( listId ) {
      type = 'list'
    }

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
              _jp.value( item, '$..publishedTimeText..text' ) ||
              _jp.value( item, '$..publishedTimeText..simpleText' )
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
            const duration = parseDuration( lengthText || '0:00' )

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
              _jp.value( item, '$..shortBylineText..text' ) ||
              _jp.value( item, '$..longBylineText..text' ) ||
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

              subCount: _parseSubCountLabel( sub_count_label ),
              subCountLabel: sub_count_label
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

function _parseVideoInitialData ( responseText, callback )
{
  debug( '_parseVideoInitialData' )

  const re = /{.*}/
  const $ = _cheerio.load( responseText )

  let initialData = ''

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

  let initialPlayerData = ''

  if ( !initialPlayerData ) {
    const scripts = $( 'script' )

    for ( let i = 0; i < scripts.length; i++ ) {
      const script = $( scripts[ i ] ).html()

      const lines = script.split( '\n' )
      lines.forEach( function ( line ) {
        let i
        while ( ( i = line.indexOf( 'ytInitialPlayerResponse' ) ) >= 0 ) {
          line = line.slice( i + 'ytInitialPlayerResponse'.length )
          const match = re.exec( line )
          if ( match && match.length > initialPlayerData.length ) {
            initialPlayerData = match
          }
        }
      } )
    }
  }

  if ( !initialPlayerData ) {
    return callback( 'could not find inital player data in the html document' )
  }

  // debug( initialData[ 0 ] )
  // debug( '\n------------------\n' )
  // debug( initialPlayerData[ 0 ] )

  const idata = JSON.parse( initialData[ 0 ] )
  const ipdata = JSON.parse( initialPlayerData[ 0 ] )

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
    _jp.value( ipdata, '$..description..text' ) ||
    _jp.value( ipdata, '$..description..simpleText' ) ||
    _jp.value( idata, '$..description..text' ) ||
    _jp.value( idata, '$..description..simpleText' )
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

  const timestamp = msToTimestamp( seconds * 1000 )

  const duration = parseDuration( timestamp )

  const sentimentBar = (
    // ex. "tooltip": "116,701 / 8,930"
    _jp.value( idata, '$..sentimentBar..tooltip' )
    .split( /[,.]/ ).join( '' )
    .split( /\D+/ )
  )

  const likes = Number( sentimentBar[ 0 ] )
  const dislikes = Number( sentimentBar[ 1 ] )

  const uploadDate = _jp.value( idata, '$..dateText' )

  const video = {
    title: title,
    description: description,

    url: TEMPLATES.YT + author_url,
    videoId: videoId,

    seconds: Number( duration.seconds ),
    timestamp: duration.timestamp,
    duration: duration,

    views: Number(
      _jp.value( ipdata, '$..videoDetails..viewCount' )
    ),

    genre: ( _jp.value( ipdata, '$..category' ) || '' ).toLowerCase(),

    uploadDate: _jp.value( ipdata, '$..uploadDate' ),
    ago: _humanTime( new Date( uploadDate ) ), // ex: 10 years ago
    thumbnail: thumbnailUrl,

    author: {
      name: author_name,
      url: TEMPLATES.YT + author_url
    }
  }

  callback( null, video )
}

function _parsePlaylistInitialData ( responseText, callback )
{
  debug( '_parsePlaylistInitialData' )

  const re = /{.*}/
  const $ = _cheerio.load( responseText )

  let initialData = ''

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

  const idata = JSON.parse( initialData[ 0 ] )

  const listId = _jp.value( idata, '$..playlistId' )

  if ( !listId ) {
    return callback( 'playlist unavailable' )
  }

  const title = (
    _jp.value( idata, '$..microformat..title' ) ||
    _jp.value( idata, '$..sidebar..title..text' ) ||
    _jp.value( idata, '$..sidebar..title..simpleText' )
  )

  const url = TEMPLATES.YT + '/playlist?list=' + listId

  const thumbnailUrl = (
    _jp.value( idata, '$..thumbnail..url' )
  )
  const thumbnail = _normalizeThumbnail( thumbnailUrl )

  const description = (
    _jp.value( idata, '$..microformat..description' ) || ''
  )

  const author_name = (
    _jp.value( idata, '$..videoOwner..title..text' ) ||
    _jp.value( idata, '$..videoOwner..title..simpleText' ) ||
    _jp.value( idata, '$..owner..title..text' ) ||
    _jp.value( idata, '$..owner..title..simpleText' )
  )

  const author_url = (
    _jp.value( idata, '$..videoOwner..title..url' ) ||
    _jp.value( idata, '$..owner..title..url' )
  )

  let videos = (
    _jp.value( idata, '$..sidebar..stats[0]..text' ) ||
    _jp.value( idata, '$..sidebar..stats[0]..simpleText' )
  )

  let views = (
    _jp.value( idata, '$..sidebar..stats[1]..text' ) ||
    _jp.value( idata, '$..sidebar..stats[1]..simpleText' )
  )

  let lastUpdateLabel = (
    _jp.value( idata, '$..sidebar..stats[2]..text' ) ||
    _jp.value( idata, '$..sidebar..stats[2]..simpleText' )
  )

  if ( videos ) {
    videos = Number( videos.replace( /\D+/g, '' ) )
  }

  if ( views ) {
    views = _parseSubCountLabel( views )
  }

  console.log( lastUpdateLabel )

  let lastUpdate
  if ( lastUpdateLabel ) {
    lastUpdate = _parsePlaylistLastUpdateTime( lastUpdateLabel )
  }

  const items = _jp.query( idata, '$..playlistVideoRenderer' )

  const list = []

  for ( let i = 0; i < items.length; i++ ) {
    try {
      const item = items[ i ]

      const videoId = (
        _jp.value( item, '$..videoId' )
      )

      const thumbnail = (
        _normalizeThumbnail( _jp.value( item, '$..thumbnail..url' ) )
      )

      const title = (
        _jp.value( item, '$..title..text' ) ||
        _jp.value( item, '$..title..simpleText' )
      )

      const timestamp = (
        _jp.value( item, '$..lengthText..text' ) ||
        _jp.value( item, '$..lengthText..simpleText' )
      )

      const duration = parseDuration( timestamp || '0:00' )

      const author_name = (
        _jp.value( item, '$..shortBylineText..text' ) ||
        _jp.value( item, '$..longBylineText..text' )
      )

      const author_url = (
        _jp.value( item, '$..shortBylineText..url' ) ||
        _jp.value( item, '$..longBylineText..url' )
      )

      list.push( {
        title: title,

        videoId: videoId,
        listId: listId,

        duration: duration,
        timestamp: duration.timestamp,
        seconds: duration.seconds,

        thumbnail: thumbnail,
        url: TEMPLATES.YT + '/watch?v=' + videoId,

        author: {
          name: author_name,
          url: TEMPLATES.YT + author_url
        }
      } )
    } catch ( err ) {
      // possibly deleted videos, ignore
    }
  }

  const playlist = {
    title: title,

    listId: listId,

    url: TEMPLATES.YT + '/playlist?list=' + listId,
    thumbnail: thumbnail,

    videos: list,
    views: views,
    date: lastUpdate,

    author: {
      name: author_name,
      url: TEMPLATES.YT + author_url
    }
  }

  callback( null, playlist )
}
