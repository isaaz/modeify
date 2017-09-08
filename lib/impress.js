var express = require('express');
var app = express();

module.exports = function (req, res) {
  if (req.method == 'GET'){
    res.render('impression');
  }
  if (req.method == 'POST'){
  }
}
