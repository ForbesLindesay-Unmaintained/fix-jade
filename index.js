var fs = require('fs')
var read = fs.readFileSync
var write = fs.writeFileSync
var readdir = fs.readdirSync
var stat = fs.statSync
var path = require('path')
var join = path.join
var relative = path.relative

module.exports = (exports = fixString)

exports.fixString = fixString
function fixString(src) {
  var replacements = 0
  if (/^([ \t]*style\b.*)$/gm.test(src)) {
    src = src.replace(/^([ \t]*style\b.*)$/gm, function (_, line) {
      if (!/\.$/.test(line)) {
        replacements++
        return line + '.'
      } else {
        return line
      }
    })
  }
  if (/^([ \t]*script\b.*)$/gm.test(src)) {
    src = src.replace(/^([ \t]*script\b.*)$/gm, function (_, line) {
      if (!/\.$/.test(line) && !/src=/.test(line) && (!/type=/.test(line) || /type=("|')text\/javascript('|")/.test(line))) {
        replacements++
        return line + '.'
      } else {
        return line
      }
    })
  }
  return {src: src, replacements: replacements}
}

exports.processFile = processFile
function processFile(file) {
  var src = read(file).toString()
  var fix = fixString(src)
  src = fix.src
  var replacements = fix.replacements
  if (replacements) {
    write(file, src)
  }
  return replacements
}

exports.processDir = processDir
function processDir(dir, log) {
  log = log || function () {}
  var res = []
  readdir(dir)
    .forEach(function (sub) {
      var path = join(dir, sub)
      var isDirectory = null
      try {
        isDirectory = stat(path).isDirectory()
      } catch (ex) {
        return
      }
      if (isDirectory) {
        res = res.concat(processDir(path, log))
      } else if (/\.jade$/.test(path)) {
        var replacements = processFile(path)
        log(path, replacements)
        res.push({path: path, replacements: replacements})
      }
    })
  return res
}

