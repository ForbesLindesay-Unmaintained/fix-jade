var github = require('./lib/github')

github.watchers('visionmedia', 'jade')
  .pipe(github.processUsers(null, function (err) {
    if (err) console.log(err.stack || err.message || err)
    else console.log('done')
  }))

var listeners = []
var log = console.log
console.log = function (msg) {
  for (var i = 0; i < listeners.length; i++) {
    listeners[i](msg)
  }
  return log.apply(console, arguments)
}
require('http').createServer(function (req, res) {
  if (req.url != '/log') {
    res.writeHead(404)
    return res.end('404')
  }
  res.setHeader('Content-Type', 'text/plain')
  listeners.push(handler)
  function handler(msg) {
    res.write(msg + '\n')
  }
  setTimeout(function () {
    listeners = listeners.filter(function (h) { return h != handler})
    res.end()
  }, 10000)
}).listen(3000)
