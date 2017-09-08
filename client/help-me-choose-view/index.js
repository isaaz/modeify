var analytics = require('../analytics')
var d3 = require('d3')
var hogan = require('hogan.js')
var log = require('../log')('help-me-choose')
var modal = require('../modal')
var RouteModal = require('../route-modal')
var routeResource = require('../route-resource')
var routeSummarySegments = require('../route-summary-segments')
var session = require('../session')
var _tr = require('../translate')
var fares = require('../fares')
var pollution = require('../pollution')
var pdf = require('../jspdf.min.js')
require('../html2canvas.js')

var optionTemplate = hogan.compile(require('./option.html'))
var routeTemplate = hogan.compile(require('./route.html'))

var METERS_TO_KILOMETERS = 0.001

var primaryFilter = 'totalCost'
var secondaryFilter = 'productiveTime'

var filters = {
  travelTime: function (a) {
    return a.time
  },
  totalCost: function (a) {
    return a.cost
  },
  walkDistance: function (a) {
    return a.walkDistance
  },
  calories: function (a) {
    return -a.calories
  },
  productiveTime: function (a) {
    return -a.productiveTime
  },
  weightLost: function (a) {
    return -a.weightLost
  },
  timeSavings: function (a) {
    return -a.timeSavings
  },
  emissions: function (a) {
    return -a.emissions
  },
  none: function (a) {
    return 0
  }
}

/**
 * Expose `Modal`
 */

var Modal = module.exports = modal({
  closable: true,
  width: '888px',
  template: require('./template.html')
}, function (view, routes) {
  view.primaryFilter = view.find('#primary-filter')
  view.secondaryFilter = view.find('#secondary-filter')

  view.primaryFilter.querySelector('[value="none"]').remove()

  view.primaryFilter.value = primaryFilter
  view.secondaryFilter.value = secondaryFilter

  view.oneWay = true
  view.daily = true
 
  view = _tr.inHTML(view, '.btn-dark')
  view = _tr.inHTML(view, '.title')
  view = _tr.inHTML(view, 'p')
  view = _tr.inHTML(view, 'label')
  
  view.refresh()
})

/**
 * Refresh
 */

Modal.prototype.refresh = function (e) {
  if (e) e.preventDefault()
  log('refreshing')

  primaryFilter = this.primaryFilter.value
  secondaryFilter = this.secondaryFilter.value

  var i
  var thead = this.find('thead')
  var tbody = this.find('tbody')

  // Remove rows
  tbody.innerHTML = ''

  // Remove all colors
  var headers = thead.querySelectorAll('th')
  for (i = 0; i < headers.length; i++) {
    headers[i].classList.remove('primaryFilter')
    headers[i].classList.remove('secondaryFilter')
  }
  var phead = thead.querySelector('.' + primaryFilter)
  if (phead) phead.classList.add('primaryFilter')
  var shead = thead.querySelector('.' + secondaryFilter)
  if (shead) shead.classList.add('secondaryFilter')

  // Get the indexes
  var primaryFn = filters[primaryFilter]
  var secondaryFn = filters[secondaryFilter]

  // Get the multiplier
  var multiplier = this.oneWay ? 1 : 2
  multiplier *= this.daily ? 1 : fares.tripPerYears/2

  // Get the route data
  var routes = this.model.map(function (r, index) {
    return getRouteData(r, multiplier, index)
  })

  // Sort by secondary first
  routes = rankRoutes(routes, primaryFn, secondaryFn)

  // Render
  for (i = 0; i < routes.length; i++) {
    var route = routes[i]
    tbody.innerHTML += this.renderRoute(route)
    var row = tbody.childNodes[i]
    var pcell = row.querySelector('.' + primaryFilter)
    var scell = row.querySelector('.' + secondaryFilter)

    if (pcell) pcell.style.backgroundColor = toRGBA(route.primaryColor, 0.25)
    if (scell) scell.style.backgroundColor = toRGBA(route.secondaryColor, 0.25)
  }

  // Track the results
  analytics.track('Viewed "Help Me Choose"', {
    plan: session.plan().generateQuery(),
    primaryFilter: primaryFilter,
    secondaryFilter: secondaryFilter,
    multiplier: multiplier
  })
}

/**
 * Append option
 */

Modal.prototype.renderRoute = function (data) {
  data.calories = data.calories ? parseInt(data.calories, 10).toLocaleString() + ' cals' : _tr('None')
  data.cost = data.cost ? data.cost.toFixed(2) + ' €' : _tr('Free')
  data.emissions = data.emissions ? parseInt(data.emissions, 10) + ' g' : _tr('None')
  data.emissionsNOx = data.emissionsNOx ? parseInt(data.emissionsNOx * 10, 10) / 10 + ' g' : _tr('None')
  data.emissionsPM10 = data.emissionsPM10 ? parseInt(data.emissionsPM10 * 100, 10) / 100 + ' g' : _tr('None')
  data.walkDistance = data.walkDistance ? data.walkDistance + ' m' : _tr('None')
  data.weightLost = data.weightLost ? Math.round(data.weightLost) + ' g' : _tr('None')
  
  if (data.productiveTime) {
    if (data.productiveTime > 120) {
      data.productiveTime = parseInt(data.productiveTime / 60, 10).toLocaleString() + ' hrs'
    } else {
      data.productiveTime = parseInt(data.productiveTime, 10).toLocaleString() + ' min'
    }
  } else {
    data.productiveTime = _tr('None')
  }
  if (data.timeSavings) {
    if (data.timeSavings > 120) {
      data.timeSavings = parseInt(data.timeSavings / 60, 10).toLocaleString() + ' hrs'
    } else {
      data.timeSavings = parseInt(data.timeSavings, 10).toLocaleString() + ' min'
    }
  } else {
    data.timeSavings = _tr('None')
  }
  var tmpTemplate = routeTemplate.render(data)
  tmpTemplate = _tr.stringOfHTML(tmpTemplate, 'select', 0)
  return tmpTemplate
}

/**
 * Filters
 */

Modal.prototype.filters = function () {
  var options = ''
  for (var f in filters) {
    options += optionTemplate.render({
      name: _tr(toCapitalCase(f).toLowerCase()),
      value: f
    })
  }
  return options
}

Modal.prototype.printPDF = function () {
  /*var elem = document.querySelector('.table-responsive')
  html2canvas(elem, {
    onrendered: function (canvas) {
      var img = canvas.toDataURL("img/png")
      var doc = new pdf()
      doc.addImage(img, 'JPEG', 6, 5)
      doc.save('aaa.pdf')
    }
  })*/
  window.open('/api/impress')
}

/**
 * Select this option
 */

Modal.prototype.selectRoute = function (e) {
  e.preventDefault()
  if (e.target.tagName !== 'BUTTON') return
  var elem = document.querySelector('.table-responsive')
  var elemChanged = elem.childNodes[1].childNodes[3].innerHTML

  var index = e.target.getAttribute('data-index')
  var route = this.model[index]
  var plan = session.plan()
  var tags = route.tags(plan)
  var self = this

  // Afficher la feuille de route

  var el = document.querySelectorAll('li.RouteCard')[index]
  var expanded = document.querySelector('.option.expanded')
  if (expanded) expanded.classList.remove('expanded')

  el.classList.add('expanded')

  analytics.track('Expanded Route Details', {
    plan: session.plan().generateQuery(),
    route: {
      modes: route.modes(),
      summary: route.summary()
    }
  })
  
  elem.childNodes[1].childNodes[3].innerHTML = selectLine(elemChanged, index)
  var legend = getLegend(elem)
  //post('/impress', {routeCard: el, helpMe: elem, leg: legend})
  window.open('/impress')
  /*var img
  var img2
  var doc = new pdf()
  html2canvas(elem, {
    onrendered: function (canvas) {
      var extra_canvas = document.createElement("canvas");
      extra_canvas.setAttribute('width', 750);
      extra_canvas.setAttribute('height', 180);
      var ctx = extra_canvas.getContext('2d');
      ctx.drawImage(canvas,0,0,canvas.width, canvas.height,0,0,750,180);
      img = extra_canvas.toDataURL("img/png")
      html2canvas(el, {
        onrendered: function (canvas) {
          img2 = canvas.toDataURL("img/png")
          doc.addImage(img2, 'JPEG', 16, 50)
          doc.addImage(img, 'JPEG', 6, 5)
          doc.save('aaa.pdf')
        }
      })
    }
  })*/

  var route = this.model[index]
  var plan = session.plan()
  var tags = route.tags(plan)
  var self = this

  routeResource.findByTags(tags, function (err, resources) {
    if (err) log.error(err)

    var routeModal = new RouteModal(route, null, {
      context: 'help-me-choose',
      resources: resources
    })
    self.hide()
    routeModal.show()
    routeModal.on('next', function () {
      routeModal.hide()
    })
  })
}

/**
 * Delete all options except the select one to print it
 */

function selectLine(elem, index){
  var separator = elem.indexOf('data-index="' + index)
  var startElem = elem.slice(0, separator)
  var endElem = elem.slice(separator+1)
  var start = startElem.lastIndexOf("<tr>")
  var end = startElem.length + endElem.indexOf('</tr>') + 5
  elem = elem.slice(start, end)
  var startButton = elem.lastIndexOf("<td>")
  var endButton = elem.lastIndexOf("</td>") + 5
  elem = elem.slice(0, startButton-1) + elem.slice(endButton)
  return elem
 }

/**
 * Add text with the icons
 */
function getLegend(elem){
  var elems = elem.querySelectorAll("th")
  var results = []
  for (var i = 1; i < 11; i++){
    results[i] = elems[i].innerHTML + "<div class=\"basic\">" +
    (elems[i].outerHTML.slice(elems[i].outerHTML.indexOf('title') + 7, elems[i].outerHTML.indexOf('"><i'))).replace(/ /g, "<br />")
    + "</div>"
  }
}

/**
 * Multipliers
 */

Modal.prototype.setOneWay = function (e) {
  this.oneWay = true
  this.setMultiplier(e)
}

Modal.prototype.setRoundTrip = function (e) {
  this.oneWay = false
  this.setMultiplier(e)
}

Modal.prototype.setDaily = function (e) {
  this.daily = true
  this.setMultiplier(e)
}

Modal.prototype.setYearly = function (e) {
  this.daily = false
  this.setMultiplier(e)
}

Modal.prototype.setMultiplier = function (e) {
  e.preventDefault()

  var button = e.target
  var parent = button.parentNode
  var buttons = parent.getElementsByTagName('button')

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('active')
  }

  button.classList.add('active')

  this.refresh()
}

/**
 * Rank & sort the routes
 */

function rankRoutes (routes, primary, secondary) {
  var primaryDomain = [d3.min(routes, primary), d3.max(routes, primary)]
  var secondaryDomain = [d3.min(routes, secondary), d3.max(routes, secondary)]

  var primaryScale = d3.scale.linear()
    .domain(primaryDomain)
    .range([0, routes.length * 2])

  var secondaryScale = d3.scale.linear()
    .domain(secondaryDomain)
    .range([1, routes.length])

  var primaryColor = d3.scale.linear()
    .domain(primaryDomain)
    .range(['#f5a81c', '#fff'])

  var secondaryColor = d3.scale.linear()
    .domain(secondaryDomain)
    .range(['#8ec449', '#fff'])

  routes = routes.map(function (r) {
    r.primaryRank = primaryScale(primary(r))
    r.primaryColor = primaryColor(primary(r))
    r.secondaryRank = secondaryScale(secondary(r))
    r.secondaryColor = secondaryColor(secondary(r))
    r.rank = r.primaryRank + r.secondaryRank
    return r
  })

  routes.sort(function (a, b) {
    return a.rank - b.rank
  }) // lowest number first

  return routes
}

/**
 * RGB to transparent
 */

function toRGBA (rgb, opacity) {
  var c = d3.rgb(rgb)
  return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + opacity + ')'
}

/**
 * Met la première lettre en majuscule
 */

function toCapitalCase (string) {
  return toNoCase(string).replace(/(^|\s)(\w)/g, function (matches, previous, letter) {
    return previous + letter.toUpperCase();
  });
}

var hasCamel = /[a-z][A-Z]/;


/**
 * Remove any starting case from a `string`, like camel or snake, but keep
 * spaces and punctuation that may be important otherwise.
 *
 * @param {String} string
 * @return {String}
 */

function toNoCase (string) {
  if (hasCamel.test(string)) string = uncamelize(string);
  return string.toLowerCase();
}


/**
 * Camelcase splitter.
 */

var camelSplitter = /(.)([A-Z]+)/g;
/**
 * Un-camelcase a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function uncamelize (string) {
  return string.replace(camelSplitter, function (m, previous, uppers) {
    return previous + ' ' + uppers.toLowerCase().split('').join(' ');
  });
}

/**
 * get CO2 production
 */
 function getEmissions(route){
   return pollution.getCarCO2Pollution(route) + pollution.getBusCO2Pollution(route) + pollution.getCoachCO2Pollution(route) + pollution.getTrainCO2Pollution(route)
 }

/**
 * get NOx production
 */
 function getEmissionsNOx(route){
   return pollution.getCarNOxPollution(route) + pollution.getBusNOxPollution(route) + pollution.getCoachNOxPollution(route) + pollution.getTrainNOxPollution(route)
 }

/**
 * get PM10 production
 */
 function getEmissionsPM10(route){
   return pollution.getCarPM10Pollution(route) + pollution.getBusPM10Pollution(route) + pollution.getCoachPM10Pollution(route) + pollution.getTrainPM10Pollution(route)
 }

/**
 * Get route data
 */

function getRouteData (route, multiplier, index) {
  var data = {
    segments: routeSummarySegments(route, {
      inline: true
    }),
    index: index,
    time: route.average(),
    frequency: 0,
    cost: route.cost(),
    walkDistance: route.walkDistances(),
    calories: route.totalCalories(),
    weightLost: 1000 * route.weightLost() / route.tripm(), 
    productiveTime: route.timeInTransit(),
    timeSavings: route.timeSavings(),
    emissions: getEmissions(route),
    emissionsNOx: getEmissionsNOx(route),
    emissionsPM10: getEmissionsPM10(route),
    score: route.score(),
    rank: 0
  }

  if (multiplier > 1) {
    ['calories', 'weightLost', 'productiveTime', 'timeSavings', 'emissions', 'emissionsNOx', 'emissionsPM10'].forEach(function (type) {
      data[type] = data[type] * multiplier
    })
    var daily = true
    var roundTrip = false
    if (multiplier == 2){
      daily=true
      roundTrip=true
    }
    if (multiplier > 150 && multiplier < 367){
      daily=false
      roundTrip=false
    }
    if (multiplier >= 368){
      daily=false
      roundTrip=true
    }
    var cost = 0
    var day = daily ? "daily" : "yearly"
    var trip = roundTrip ? "RoundTrip" : ""
    var selector = day + trip
    if (route.hasTransit()) {
      cost += fares.transit[selector]
    }
    if (route.hasBikingRental()){
      cost += fares.bicycle_rent[selector]
    }
    if (route.hasCar() || route.hasCarPark()) {
    if (route.hasCar()) {
      cost += fares.parking[selector]
      }
      cost +=  route.vmtRate() * route.driveDistance() * METERS_TO_KILOMETERS * multiplier
    
    }
    if (cost) data.cost = cost
  }
  return data
}

/**
 * post function
 */

 function post(path, params) {
    var method = "post"

    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);

    for(var key in params) {
        if(params.hasOwnProperty(key)) {
            var hiddenField = document.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", params[key]);

            form.appendChild(hiddenField);
         }
    }

    document.body.appendChild(form);
    form.submit();
}