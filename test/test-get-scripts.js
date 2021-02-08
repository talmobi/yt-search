
const fs = require( 'fs' )
const path = require( 'path' )

const test = require( 'tape' )

const cheerio = require( 'cheerio' )

const { _getScripts, _findLine, _between } = require( '../src/util.js' )

test( '_getScripts', function ( t ) {
  const responseText = fs.readFileSync( path.join( __dirname, 'stage', 'jumbled-script-tags.response-html' ), 'utf8' )

  const scriptsText = _getScripts( responseText )

  const initialData = _between(
    _findLine( /ytInitialData.*=\s*{/, scriptsText ), '{', '}'
  )

  t.ok( initialData )
  t.end()
} )
