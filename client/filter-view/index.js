var debounce = require('debounce')
var reactiveSelect = require('../reactive-select')
var view = require('../view')
var session = require('../session')
var _tr = require('../translate')
var fares = require('../fares')

var View = module.exports = view(require('./template.html'), function (view, plan) {
  _tr.inHTML(view, "option")
  _tr.inHTML(view, ".btn-dark")
  _tr.inHTML(view, "label")
  view.reactive.use(reactiveSelect)
  view.showSettings()
  view.on('active', function () {
    plan.updateRoutes()
  })
  view.on('selected', function () {
    plan.updateRoutes()
  })
})

var times = hourOptions()

View.prototype.startTimes = function () {
  return times.slice(0, -1)
}

View.prototype.endTimes = function () {
  return times.slice(1)
}

View.prototype.bikeSpeeds = function () {
  return [8, 10, 12, 14, 16, 18, 20].map(function (s) {
    return {
      name: s + ' km/h',
      value: s
    }
  })
}

View.prototype.walkSpeeds = function () {
  return [3, 4, 5, 6].map(function (s) {
    return {
      name: parseInt(s, 10) + ' km/h&nbsp;&nbsp;',
      value: s
    }
  })
}

View.prototype.parseInt = parseInt

function hourOptions () {
  var times = []
  for (var i = 0; i <= 24; i++) {
    times.push(toOption(i))
  }
  return times
}

function toOption (n) {
  var opt = {
    name: '',
    value: n
  }

  if (n > 23 || n === 0) opt.name = _tr('Midnight')
  //else if (n > 12) opt.name = n - 12 + 'pm'
  else if (n > 12) opt.name = n + 'h'
  else if (n === 12) opt.name = _tr('Noon')
  //else opt.name = n + 'am'
  else opt.name = n + 'h'

  return opt
}

View.prototype.showSettings = function () {
  this.find('.ExpandedSettings').classList.add('open')
}

View.prototype.hideSettings = function () {
  this.find('.ExpandedSettings').classList.remove('open')
}

View.prototype.save = debounce(function (e) {
  var names = ['maxBikeTime', 'maxWalkTime', 'carParkingCost', 'carParkingCostYearly', 'carCostPerMile', 'bikeSafe', 'bikeSlope', 'bikeTime']
  var self = this
  var values = {}
  names.forEach(function (n) {
    values[n] = parseFloat(self.find('input[name=' + n + ']').value)
  })
  var percentage = getPercentage(values['bikeSafe'], values['bikeSlope'], values['bikeTime'])
  values.bikeSafe = percentage.bikeSafe
  values.bikeSlope = percentage.bikeSlope
  values.bikeTime = percentage.bikeTime
  pollution.setCar(self.find('select[name=carType]').value)
  var scorer = this.model.scorer()
  scorer.rates.carParkingCost = values.carParkingCost
  scorer.rates.carParkingCostYearly = values.carParkingCostYearly || 1000
  scorer.rates.mileageRate = values.carCostPerMile
  fares.setValues(values)
  this.model.set(values)
  this.model.updateRoutes()
  this.saveProfile()
}, 1000)

View.prototype.saveProfile = function () {
  var self = this

  if (session.user()) {
    setTimeout(function () {
      var customData = session.user().customData()
      if (!customData.modeify_opts) customData.modeify_opts = {}
      customData.modeify_opts.bikeSpeed = self.model.bikeSpeed()
      customData.modeify_opts.walkSpeed = self.model.walkSpeed()
      customData.modeify_opts.maxBikeTime = self.model.maxBikeTime()
      customData.modeify_opts.maxWalkTime = self.model.maxWalkTime()
      customData.modeify_opts.carParkingCost = self.model.carParkingCost()
      customData.modeify_opts.carParkingCostYearly = self.model.carParkingCostYearly()
      customData.modeify_opts.carCostPerMile = self.model.carCostPerMile()
      customData.modeify_opts.bikeSafe = self.model.bikeSafe()
      customData.modeify_opts.bikeSlope = self.model.bikeSlope()
      customData.modeify_opts.bikeTime = self.model.bikeTime()

      session.user().customData(customData)
      session.user().saveCustomData(function () {}) // TODO: handle error
    }, 1000)
  }
}

//ensure bike safe, slope and time are a percentage
function getPercentage(safe, slope, time){
  if (safe < 0) safe = 0
  if (slope < 0) slope = 0
  if (time < 0) time = 0
  var total = safe + slope + time
  if (total) { //pas de division par 0
    safe = Math.floor(100 * safe / total)
    slope = Math.floor(100 * slope / total)
    time = Math.floor(100 * time / total)
  }
  else {
    safe = 33
    slope = 33
    time = 34
  }
  while (safe + slope + time !== 100){
    if (safe + slope + time > 100){
      if (safe > 0) safe--
      else if (slope > 0) slope--
      else time--
    }
    if (safe + slope + time < 100){
      if (safe < 100) safe++
      else if (slope < 100) slope++
      else time++
    }
  }
  var percent = {}
  percent.bikeSafe = safe
  percent.bikeSlope = slope
  percent.bikeTime = time
  return percent
}
