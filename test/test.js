let yts = require( '../src/index.js' )

if ( !!process.env.production ) {
  yts = require( '../dist/yt-search.min.js' )
}

const test = require( 'tape' )

test( 'basic search', function ( t ) {
  t.plan( 4 )

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
    t.equal( koyaani.videoId, '_4Vt0UGwmgQ', 'koyani video id equal!' )
    t.equal( koyaani.timestamp, '3:29', 'koyani video timestamp equal!' )
  } )
} )

test( 'videos, playlists and users/channels', function ( t ) {
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

test( 'test order and relevance', function ( t ) {
  t.plan( 2 )

  const opts = {
    search: "Josh A & Jake Hill - Rest in Pieces (Lyrics)"
  }

  yts( opts, function ( err, r ) {
    t.error( err, 'no errors OK!' )

    const top3Videos = r.videos.slice( 0, 3 )

    let hasTitle = false
    top3Videos.forEach( function ( v ) {
      if ( v.title.match( /josh.*jake.*hill.*rest.*piece.*lyric/i ) ) {
        hasTitle = true
      }
    } )

    t.ok( hasTitle, 'relevance and order OK' )
  } )
} )

test( 'test non-en same top results and duration parsing', function ( t ) {
  t.plan( 4 )

  const opts = {
    search: "Josh A & Jake Hill - Rest in Pieces (Lyrics)"
  }

  yts( opts, function ( err, r ) {
    t.error( err, 'no errors OK!' )

    const topVideo = r.videos[ 0 ]

    yts( {
      search: opts.search,
      hl: 'fi'
    }, function ( err, r ) {
      t.error( err, 'no errors OK!' )

      const videos = r.videos

      t.equal( topVideo.title, videos[ 0 ].title, 'top result title the same!' )
      t.equal( topVideo.duration.timestamp, videos[ 0 ].duration.timestamp, 'top result timestamp the same!' )
    } )
  } )
} )

test( 'search by video id', function ( t ) {
  t.plan( 3 )

  const opts = {
    search: "_JzeIf1zT14"
  }

  yts( opts, function ( err, r ) {
    t.error( err, 'no errors OK!' )

    const topVideo = r.videos[ 0 ]

    t.ok( topVideo.title.match( /josh.*jake.*hill.*rest.*piece.*lyric/i ), 'top result title matched!' )
    t.ok( topVideo.videoId, opts.search, 'top result video id matched!' )
  } )
} )

test( 'test single video metadata capture', function ( t ) {
  t.plan( 12 )

  yts( { videoId: 'e9vrfEoc8_g' }, function ( err, video ) {
    t.error( err, 'no errors OK!' )

    const MILLION = 1000 * 1000

    t.equal( video.title, 'Superman Theme', 'title' )
    t.equal( video.videoId, 'e9vrfEoc8_g', 'videoId' )
    t.equal( video.timestamp, '4:13', 'timestamp' )
    t.equal( video.seconds, 253, 'seconds (duration)' )

    t.ok( video.views > ( 35 * MILLION ), 'views over 35 Million' )

    t.equal( video.genre, 'music', 'genre is music' )
    t.equal( video.uploadDate, '2009-07-27', 'uploadDate' )

    t.equal( video.author.id, 'Redmario2569', 'author id' )
    t.equal( video.author.url, 'https://youtube.com/user/Redmario2569', 'author url' )

    t.equal( video.thumbnail, 'https://i.ytimg.com/vi/e9vrfEoc8_g/default.jpg', 'author id' )
    t.equal( video.image, 'https://i.ytimg.com/vi/e9vrfEoc8_g/hqdefault.jpg', 'author url' )
  } )
} )
