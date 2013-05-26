var Readable = require('stream').Readable || require('readable-stream').Readable
var Transform = require('stream').Transform || require('readable-stream').Transform
var Writable = require('stream').Writable || require('readable-stream').Writable
var util = require('util')
var path = require('path')
var join = path.join
var relative = path.relative
var fs = require('fs')

var rimraf = require('rimraf')
var gethub = require('gethub')
var Client = require('github')
require('github/util').log = function () {}

var fix = require('../')
require('./fix-json')

var processed = join(__dirname, '..', 'processed')
try { fs.mkdirSync(processed) } catch (ex) { if (ex.code != 'EEXIST') throw ex }
var temp = join(__dirname, '..', 'temp')
try { fs.mkdirSync(temp) } catch (ex) { if (ex.code != 'EEXIST') throw ex }

var client = new Client({version: '3.0.0', debug: false});
client.authenticate({
  type: 'oauth',
  token: '<TOKEN>'
})

//relatedRepos('visionmedia', 'jade').pipe(stringify()).pipe(process.stdout)
//repos('visionmedia').pipe(stringify()).pipe(process.stdout)
//pullRequests('visionmedia', 'jade').pipe(stringify()).pipe(process.stdout)

//Stream of `user` as string
exports.watchers = watchers
function watchers(user, repo) {
  var stream = new Readable({objectMode: true})
  var page = 1
  var running = false
  stream._read = function () {
    if (running) return
    running = true
    client.repos.getWatchers({
      user: user,
      repo: repo,
      page: page++,
      per_page: 100
    }, function (err, res) {
      if (err) throw err
      if (res.length === 0) return stream.push(null)
      var cont = false
      for (var i = 0; i < res.length; i++) {
        cont = stream.push(res[i].login)
      }
      running = false
      if (cont) stream._read()
    })
  }
  return stream
}

//Stream of `{owner: string, name: string, branch: string}`
exports.repos = repos
function repos(user) {
  var stream = new Readable({objectMode: true})
  var page = 1
  var running = false
  stream._read = function () {
    if (running) return
    running = true
    client.repos.getFromUser({
      user: user,
      page: page++,
      per_page: 100
    }, function (err, res) {
      if (err) throw err
      if (res.length === 0) return stream.push(null)
      var cont = true
      for (var i = 0; i < res.length; i++) {
        if (!res[i].fork) {
          cont = stream.push({
            owner: res[i].owner.login,
            name: res[i].name,
            branch: res[i].master_branch
          })
        }
      }
      running = false
      if (cont) stream._read()
    })
  }
  return stream
}

//Stream of `{owner: string, name: string, branch: string}`
exports.relatedRepos = relatedRepos
function relatedRepos(user, repo) {
  var expand = new Transform({objectMode: true})
  expand._transform = function (user, encoding, callback) {
    repos(user)
      .on('data', function (repo) {
        expand.push(repo)
      })
      .on('error', callback)
      .on('end', function () {
        callback()
      })
  }
  return watchers(user, repo).pipe(expand)
}

//Stream of `{number: number, state: 'open'|'closed', user: string, title: string}
exports.pullRequests = pullRequests
function pullRequests(user, repo, state) {
  var stream = new Readable({objectMode: true})
  var page = 1
  var running = false
  var s = state || 'open'
  stream._read = function () {
    if (running) return
    running = true
    client.pullRequests.getAll({
      user: user,
      repo: repo,
      state: s,
      page: page++,
      per_page: 100
    }, function (err, res) {
      if (err) throw err
      if (res.length === 0) {
        if (s === 'open' && state !== 'open') {
          s = 'closed'
          page = 1
          running = false
          return stream._read()
        }
        return stream.push(null)
      }
      var cont = true
      for (var i = 0; i < res.length; i++) {
        cont = stream.push({
          number: res[i].number,
          state: res[i].state,
          user: res[i].user && res[i].user.login,
          title: res[i].title
        })
      }
      running = false
      if (cont) stream._read()
    })
  }
  return stream
}

/**
fork('visionmedia', 'jade', function (err) {
})
*/
exports.fork = fork
function fork(user, repo, org, cb) { //org is optional
  if (typeof org === 'function') cb = org, org = undefined
  return client.repos.fork({
    user: user,
    repo: repo,
    org: org
  }, function (err) {
    if (err) return cb(err)
    setTimeout(function () {
      cb()
    }, 5000)//forking is asynchronous, so give it a little time to complete
  })
}

/**
  pull(['jade-bot', 'jade', 'master'], ['visionmedia', 'jade', 'master'], {title: 'Test PR', body: 'This is a test pull request'}, function (err) {
  })
 */
exports.pull = pull
function pull(from, to, msg, cb) {
  client.pullRequests.create({
    user: to[0],
    repo: to[1],
    title: msg.title,
    body: msg.body,
    base: to[2],
    head: from[0] + ':' + from[2]
  }, cb)
}

/**
 * Usage:
 *
 *     commit('jade-bot', 'jade', 'master', 'test automated commit', [{path: 'auto-created.txt', content: 'this file was created by a bot'}], function (err) {
 *       if (err) throw err
 *       console.log('done')
 *     })
 */
exports.commit = commit
function commit(user, repo, branch, message, updates, callback) {
  var shaLatestCommit, shaBaseTree, shaNewTree, shaNewCommit
  client.gitdata.getReference({
    user: user,
    repo: repo,
    ref: 'heads/' + branch
  }, function (err, res) {
    if (err) return callback(err)

    shaLatestCommit = res.object.sha
    client.gitdata.getCommit({
      user: user,
      repo: repo,
      sha: shaLatestCommit
    }, function (err, res) {
      if (err) return callback(err)

      shaBaseTree = res.tree.sha
      client.gitdata.createTree({
        user: user,
        repo: repo,
        tree: updates.map(function (file) {
          return {
            path: file.path.replace(/\\/g, '/').replace(/^\//, ''),
            mode: '100644',
            type: 'blob',
            content: file.content
          }
        }),
        base_tree: shaBaseTree
      }, function (err, res) {
        if (err) return callback(err)

        shaNewTree = res.sha
        client.gitdata.createCommit({
          user: user,
          repo: repo,
          message: message,
          tree: shaNewTree,
          parents: [shaLatestCommit]
        }, function (err, res) {
          if (err) return callback(err)

          shaNewCommit = res.sha
          client.gitdata.updateReference({
            user: user,
            repo: repo,
            ref: 'heads/' + branch,
            sha: shaNewCommit,
            force: false
          }, callback)
        })
      })
    })
  })
}

/*
processRepo('esdiscuss', 'esdiscuss.org', 'master', function (err) {
  if (err) throw err
  console.log('done')
})
*/

exports.processUsers = processUsers
function processUsers(after, callback) {
  var stream = new Writable({objectMode: true})
  var seen = after === null
  stream._write = function (user, encoding, callback) {
    console.log(user)
    if (!seen) {
      seen = user === after
      return callback()
    }
    var called = false
    repos(user).pipe(processRepos(function (err) {
      if (err) stream.emit('error', err)
      if (called) return
      called = true
      return callback()
    }))
  }
  if (callback) stream.on('error', callback)
  if (callback) stream.on('finish', callback)
  return stream
}

exports.processRepos = processRepos
function processRepos(callback) {
  var stream = new Writable({objectMode: true})
  stream._write = function (repo, encoding, callback) {
    //{owner: string, name: string, branch: string}
    console.log(' - ' + repo.name)
    processRepo(repo.owner, repo.name, repo.branch, function (err) {
      if (err) stream.emit('error', err)
      return callback()
    })
  }
  if (callback) stream.on('error', callback)
  if (callback) stream.on('finish', callback)
  return stream
}

/*
repos('elbowdonkey').pipe(processRepos(function (err) {
  if (err) console.log(err.stack || err.message || err)
  else console.log('done')
}))
/*

/*
processRepo('elbowdonkey', 'printables', 'master', function (err) {
  if (err) throw err
})
*/
exports.processRepo = processRepo
function processRepo(user, repo, branch, callback) {
  if (fs.existsSync(join(processed, user + '-' + repo + '.done'))) return callback(null, false)
  var processRepo = require('domain').create() //There's an obscure bug, so just fix it with domains
  processRepo.on('error', function (ex) {
    console.log('domain error')
    return callback(ex)
  })
  processRepo.run(function () {
    var done = false
    pullRequests(user, repo)
      .on('data', function (pr) {
        if (/\[bot-update#1\]/.test(pr.title)) {
          done = true
          fs.writeFileSync(join(processed, user + '-' + repo + '.done'), '.')
          callback(null, false)
        }
      })
      .on('end', function () {
        if (done) return
        var dir = join(temp, user + '-' + repo)
        gethub(user, repo, branch, dir, function (err) {
          if (err) return callback(err)
          var files = fix.processDir(dir).filter(function (f) { return f.replacements })
          if (files.length === 0) {
            fs.writeFileSync(join(processed, user + '-' + repo + '.done'), '.')
            return rimraf(dir, function (err) { callback(err, false) })
          }
          console.log('FORKING: ' + user + '/' + repo)
          fork(user, repo, function (err) {
            if (err) return callback(err)

            var updates = files.map(function (f) {
              return {
                path: relative(dir, f.path),
                content: fs.readFileSync(f.path).toString()
              }
            })
            console.log('COMMITTING: ' + user + '/' + repo)
            commit('jade-bot', repo, branch, 'Update to maintain compatability with the latest version of jade', updates, function (err) {
              if (err) return callback(err)

              console.log('PULLING: ' + user + '/' + repo)
              pull(['jade-bot', repo, branch], [user, repo, branch], {
                title: 'Update jade files [bot-update#1]',
                body: 'Implicit text-only status for `script` and `style` tags in jade has been ' +
                      '[deprecated](https://github.com/visionmedia/jade/pull/1036), and ' +
                      'will be removed in a future version.  To be prepared, all you need to do is add a `.` after ' +
                      'all script and style tags.  This pull request helps by doing that.'
                },
                function (err) {
                  if (err) return callback(err)
                  rimraf(dir, function (err) { callback(err, true) })
                })
            })
          })
        })
      })
  })
}

exports.stringify = stringify
function stringify() {
  var stream = new Transform({objectMode: true})
  stream._transform = function (chunk, encoding, callback) {
    if (chunk instanceof Buffer) {
      this.push(chunk)
    } else if (/^v0\.[0-8]\./.test(process.version)) {
      this.push(util.inspect(chunk, false, 10, true) + '\n')
    } else {
      this.push(util.inspect(chunk, {depth: 10, colors: true}) + '\n')
    }
    callback()
  }
  return stream
}