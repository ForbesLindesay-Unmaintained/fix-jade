
//The purpose of this file is to modify JSON encoding so that it escapes
//utf8 characters.  This is needed to work with the GitHub API, which won't
//accept an encoding of UTF-8

function UTF8Escape(str){
  var i = str.length,
      aRet = [];

  while (i--) {
    var iC = str.charCodeAt(i);
    if (iC > 127) {
      var code = iC.toString(16).toUpperCase();
      while (code.length < 4) code = '0' + code;
      aRet[i] = '\\u' + code;
    } else {
      aRet[i] = str[i];
    }
  }
  return aRet.join('');
}
var oldStringify = JSON.stringify;
JSON.stringify = function (a) {
  return UTF8Escape(oldStringify.apply(this, arguments));
}