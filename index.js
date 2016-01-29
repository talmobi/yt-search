var cheerio = require('cheerio');
var request = require('request');

var yt_search_query_uri =  "https://www.youtube.com/results?search_query=";

// settings
var _opts = {
  min_results: 5,
  max_requests: 5,
  ignore_playlists: true,
  ignore_accounts: true,
  only_videos: true,
};

//var console = {
//  log: function (str) {
//    return;
//  }
//};

/**
 * Provide custom search options.
 */
function opts (opts) {
  for (key in opts) {
    _opts[key] = opts[key];
  };
};

/**
 * 
 */
function search (query, done) {
  console.log("query: " + query);
  var response = null;

  var q = query.split(/\s+/);
  var url = yt_search_query_uri + q.join('+');

  var videos = []; // found songs
  var max_loops = _opts.max_requests; // max amount of recursive calls
  var loops = 0;

  // page number (youtube seach query parameter)
  var page = 1;

  var next = function (page) {
    console.log("next called ["+loops+"]");
    loops++;

    findVideos(url, page, function (err, _videos) {
      if (err) {
        return done(err);
      } else {

        // filter videos
        for (var i = 0; i < _videos.length; i++) {
          var video = _videos[i];
          if (shouldSkip( video )) {
            console.log("skipping video: " + video.title);
            _videos.splice(i--, 1);
          }
        }

        console.log("found " + _videos.length + " songs on loop: " + loops + "/" + max_loops);
        videos = videos.concat(_videos);

        if (videos.length < _opts.min_results && videos.length > 0 && loops < max_loops) {
          console.log("minimum number of songs not found -> doing another request");
          // call the function recursively until max recursive calls are reached
          // or we've a minimum required amount of songs
          next(page + 1);
        } else {
          // finish the search and return the found songs
          console.log("number of total songs found: " + videos.length);
          return done(null, videos);
        }
      }
    });
  };
  next(page);
}

function findVideos(url, page, done) {
  console.log("finding songs from: " + url);

  page = page || 1
    url += "&page=" + page;

  request(url, function (err, res, body) {
    if (err) {
      done(err);
    } else {
      parseResponse(body, done);
    }
  });
};

function shouldSkip (video) {

  var ignore_playlists = _opts.ignore_playlists && video.url.indexOf('list') >= 0;
  var ignore_accounts = _opts.ignore_accounts && video.url.indexOf('user') >= 0;
  var only_videos = !(_opts.only_videos && video.url.indexOf('watch') >= 0);

  var duration = video.duration.seconds || video.duration;
  var title = video.title.toUpperCase();

  //var excludes = false;
  //if (filters.exclude.length > 0) {
  //  excludes = !!filters.exclude.find(function (val, ind, arr) {
  //    var str = val.toUpperCase();
  //    return title.indexOf(str) >= 0;
  //  });
  //}

  /* this is an && find, meaning that they ALL have to match simultaneously
   * (not very useful actually)
   var includes = filters.include.every(function (val, ind, arr) {
   var str = val.toUpperCase();
   return title.indexOf(str) >= 0;
   });
   */

  // this is an || find, meaning only one of them has to match, which makes much more sense
  //var includes = false;
  //if (filters.include.length > 0) {
  //  includes = !filters.include.find(function (val, ind, arr) {
  //    var str = val.toUpperCase();
  //    return title.indexOf(str) >= 0;
  //  });
  //}

  return (only_videos || ignore_playlists || ignore_accounts);
};

// parse the plain text response body with jsom to pin point song information
function parseResponse (responseText, done) {
  console.log("parsing response with cheerio");

  $ = cheerio.load(responseText);
  var titles = $('.yt-lockup-title');
  console.log("titles length: " + titles.length);
  var songs = [];

  for (var i = 0; i < titles.length; i++) {
    var title = titles[i];

    var a = $('a', title);
    var span = $('span', title);
    var duration = parseDuration( span.text() );

    var href = a.attr('href');

    var song = {
      title: a.text(),
      url: href,
      duration: duration
    };

    songs.push(song);
  };

  console.log(songs[0]);

  done(null, songs);

  /*
     jsdom.env(responseText, function (err, window) {
     var document = window.document;

     if (err) {
     return done(err);
     }

     var list = [];

     var titles = document.getElementsByClassName('yt-lockup-title');
     for (var i = 0; i < titles.length; i++) {
     var title = titles[i];

     var a = title.getElementsByTagName('a')[0];
     var span = title.getElementsByTagName('span')[0];

     var duration = parseDuration( span.innerHTML );

     var song = {
     title: a.innerHTML,
     duration: duration,
     url: a.href
     };

  // filter songs
  if (a.href.indexOf('list') >= 0 || // skip playlists
  shouldSkipSong( song )
  ) {
  //console.log("skipped song: " + song.title);
  continue;
  }

  list.push(song);
  }

  console.log("parsing done");
  done(null, list);
  });
  */
};

function parseDuration (timestampText) {
  var a = timestampText.split(" ");
  var timestamp =  a[a.length - 1].replace(/[^:\d]/g,'');

  var t = timestamp.split(":");

  var seconds = 0;
  var exp = 0;
  for (var i = t.length - 1; i >= 0; i--) {
    if (t[i].length <= 0) continue;
    var number = t[i].replace(/\D/g,'');
    //var exp = (t.length - 1) - i;
    seconds += parseInt( number ) * (exp > 0 ? Math.pow(60, exp) : 1);
    exp++;
    if (exp > 2) break;
  };

  return {
    toString: function () { return seconds + " seconds (" + timestamp + ")" },
    seconds: seconds,
    timestamp: timestamp
  };
};

function listSearch (query) {
  console.log("doing list search");
  search(query, function (list) {
    for (var i = 0; i < list.length; i++) {
      var song = list[i];
      console.log(song.title + " : " + song.duration);
      console.log("---------------");
    }
  });
};

// exports
module.exports = function (query, filters, done) {
  search(query, filters, done);
};
module.exports.opts = opts;
module.exports.search = search;

