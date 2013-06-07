#!/usr/bin/env node

var relative = require('path').relative

var color = require('bash-color')
var purple = color.purple
var green = color.green

var fix = require('../index.js')

fix.processDir(process.cwd(), function (path, replacementsCount) {
  var name = relative(process.cwd(), path).replace(/\\/g, '/')
  if (replacementsCount) {
    console.log(purple('fixed') + ' "' + name + '" ' + purple('by making ' + replacements(replacementsCount)))
  } else {
    console.log(green('skipped') + ' "' + name + '" ' + green('as it was already correct.'))
  }
})

function replacements(n) {
  return n + ' replacement' + (n === 1 ? '' : 's')
}