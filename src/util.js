const _cheerio = require( 'cheerio' )

const util ={}
module.exports = util
util._getScripts = _getScripts
util._findLine = _findLine
util._between = _between

function _getScripts ( text ) {
  // match all contents within html script tags
  const $ = _cheerio.load( text )
  const scripts = $( 'script' )

  let buffer = ''

  // combine all scripts
  for ( let i = 0; i < scripts.length; i++ ) {
    const el = scripts[ i ]
    const child = el && el.children[ 0 ]
    const data = child && child.data
    if ( data ) {
      buffer += data + '\n'
    }
  }

  return buffer
}

function _findLine ( regex, text ) {
  const cache = _findLine.cache || {}
  _findLine.cache = cache

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
