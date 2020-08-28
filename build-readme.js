const fs = require( 'fs' )
const path = require( 'path' )

let template = fs.readFileSync( './README-template.md', 'utf8' )

const yts = require( './src/index.js' )

let buffer = ''
const log = console.log
console = {
	log: function ( text ) {
		buffer += text + '\n'
	}
}

function between ( text, a, b ) {
	const i = text.indexOf( a )
	const j = text.lastIndexOf( b )
	return text.slice( i, j )
}

function parsefn ( fn, trimStart ) {
	const text = between( fn.toString(), '{', '}' )
	const lines = text.split( '\n' ).slice( 1, -1 )
	return lines.map(
		function ( line ) {
			return line.slice( trimStart )
		}
	).join( '\n' )
}

;( async function () {
	async function f_search ()
	{
		const r = await yts( 'superman theme' )

		const videos = r.videos.slice( 0, 3 )
		videos.forEach( function ( v ) {
			const views = String( v.views ).padStart( 10, ' ' )
			console.log( `${ views } | ${ v.title } (${ v.timestamp }) | ${ v.author.name }` )
		} )
	}

	template = template.split( '%f_search%' ).join( parsefn( f_search, 2 ) )
	buffer = ''
	await f_search()
	template = template.split( '%f_search_output%' ).join( buffer.trimEnd() )

	async function f_video ()
	{
		const video = await yts( { videoId: '_4Vt0UGwmgQ' } )
		console.log( video.title + ` (${ video.duration.timestamp })` )
	}

	template = template.split( '%f_video%' ).join( parsefn( f_video, 2 ) )
	buffer = ''
	await f_video()
	template = template.split( '%f_video_output%' ).join( buffer.trimEnd() )

	async function f_playlist ()
	{
		const list = await yts( { listId: 'PL7k0JFoxwvTbKL8kjGI_CaV31QxCGf1vJ' } )

		console.log( 'playlist title: ' + list.title )
		list.videos.forEach( function ( video ) {
			console.log( video.title )
		} )
	}

	template = template.split( '%f_playlist%' ).join( parsefn( f_playlist, 2 ) )
	buffer = ''
	await f_playlist()
	template = template.split( '%f_playlist_output%' ).join( buffer.trimEnd() )

	fs.writeFileSync( './README.md', template )
} )()
