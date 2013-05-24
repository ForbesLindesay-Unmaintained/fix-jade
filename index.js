#!/usr/bin/env node

var fs = require('fs')
var read = fs.readFileSync
var write = fs.writeFileSync
var readdir = fs.readdirSync
var stat = fs.statSync
var path = require('path')
var join = path.join
var relative = path.relative

var color = require('bash-color')
var purple = color.purple
var green = color.green

processDir(process.cwd())

function processDir(dir) {
  readdir(dir)
    .forEach(function (sub) {
      var path = join(dir, sub)
      if (stat(path).isDirectory()) {
        processDir(path)
      } else if (/\.jade$/.test(path)) {
        processFile(path)
      }
    })
}

function processFile(file) {
  var src = read(file).toString()
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
  var name = relative(process.cwd(), file).replace(/\\/g, '/')
  if (replacements) {
    write(file, src)
    console.log(purple('fixed') + ' "' + name + '" ' + purple('by making ' + replacements + ' replacement' + (replacements === 1 ? '' : 's')))
  } else {
    console.log(green('skipped') + ' "' + name + '" ' + green('as it was already correct.'))
  }
}