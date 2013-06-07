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
  
  function dotImplicitTextOnlyBlock(_, leadin, tagname, line, indent) {
    // Flag for if this block should have a dot appended:
    var undotted =
      // if this textOnly tag contains a block and doesn't end with a dot
      !/\.$/.test(line)
      //and isn't a script tag with a non-javascript type attribute
      //(a special case where script tags were already not implicitly textOnly)
      && tagname != 'script'
      || !(/type *= */.test(line))
      || /type *= *("|')text\/javascript('|")/.test(line)
    
    if (undotted) replacements++
    return leadin + tagname + line + undotted ? '.' : '' + indent
  }
  
  src = src.replace(/^([ \t]*)(style|script)([^\n]*)(\n\1[ \t]+)/gm, dotImplicitTextOnlyBlock)
  
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

