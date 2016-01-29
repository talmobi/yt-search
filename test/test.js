var yts = require('../index.js');
var assert = require('assert');

describe('search', function () {
  this.timeout(6000);

  it('should return without error', function (done) {
    yts('metallica', function (err, videos) {
      if (err || !videos || videos.length <= 0) {
        throw new Error("Search request failed.");
      }
      done();
    });
  });

});
