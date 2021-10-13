const yts = require( './src/index.js' )

// console.log( yts.search )
m12()

async function m12 () {
  const video = await yts({ videoId: '62ezXENOuIA' });
  console.log(video.title);
  console.log(video.url);
  console.log(video.thumbnail);
}

async function m11 () {
  const video = await yts( { videoId: '62ezXENOuIA' } ).then(function (result) {
    console.log( result )
  })
  console.log(video.title);
  console.log(video.url);
  console.log(video.thumbnail);

}

async function m10 () {
    const id = 'z95fi3uazYA'
    const res = await yts(id);
    const videoIdSearch = await yts({ videoId: id });

    console.log(videoIdSearch.videoId === res.videos[0].videoId);
    console.log(videoIdSearch.title);
    console.log(res.videos[0].title);
}

async function m9 () {
  let result = await yts({ listId: "PLQ9SiFtEqtYByscXDLGNOC8XL49BFn9tZ" });
  console.log( result )
}

async function m8 () {
  let result = await yts({ listId: "PLSwcuYF4r6MJHkUVYbDAekT7j0FvZ_B4X" });
  console.log( result )
}

async function m7 () {
  let result = await yts( 'superman theme list' );
  // let result = await yts({ listId: "PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ" });
  console.log( result )
}

async function m6 () {
  let result = await yts({ listId: "PL67B0C9D86F829544" });
  // let result = await yts({ listId: "PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ" });
  console.log( result )
}

async function m5 () {
  let result = await yts({ listId: "RDGMEM_v2KDBP3d4f8uT-ilrs8fQ" });
  console.log( result )
}

function m4 () {
  yts( { query: 'superman theme' }, function ( err, result ) {
    if ( err ) throw err
    console.log( result.videos[ 1 ].title )
  } )
}

async function m3 () {
  const r = await yts( 'live streams' )

  console.log( r.videos )
  console.log( r.live )
}

async function m2 () {
	const list = await yts( { listId: 'PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ' } )
	console.log( list )
}

async function m1 () {
	const r = await yts( 'live streams' )
	const v = r.live.sort(
		function ( b, a ) {
			return b.watching - a.watching
		}
	)[ 0 ]
	console.log( v )

	console.log(
		r.live.reduce( function ( a, c ) {
			return a + c.description
		}, '' )
	)
}

async function main () {
  const message = 'Nier: Automata - Bipolar Nightmare 【Intense Symphonic Metal Cover】'

  // find video id in message (url)
  let match = message.match( /[?&]v=(\w+)&?/ )
  const videoId = match && match[ 1 ]

  // find list id in message (url)
  match = message.match( /[?&]list=(\w+)&?/ )
  const listId = match && match[ 1 ]

  // find list index specified in message (url)
  match = message.match( /[?&]index=(\w+)&?/ )
  const listIndex = match && match[ 1 ]

  if ( videoId ) {
    // found video id in url
    const opts = { videoId: videoId }
    const r = await yts( opts )
    console.log( r )
  } else if ( listId ) {
    // only a list id was found
    const opts = { listId: listId }
    const r = await yts( opts )
    console.log( r )

    // first video in playlist
    console.log( r.videos[ 0 ] )

    if ( listIndex ) {
      console.log( r.videos[ listIndex ] )
    }
  } else {
    const r = await yts( message )
    console.log( r )
  }
}
