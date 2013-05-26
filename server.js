var github = require('./lib/github')

github.watchers('visionmedia', 'jade')
  .pipe(github.processUsers('boof', function (err) {
    if (err) console.log(err.stack || err.message || err)
    else console.log('done')
  }))

require('http').createServer(function (req, res) {
  if (req.url != '/log') return
  console.log = function (str) {
    try {
      res.write(str)
    } catch (ex) { }
  }
}).listen(3000)