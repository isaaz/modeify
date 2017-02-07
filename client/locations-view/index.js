var analytics = require('../analytics')
var closest = require('component-closest')
var log = require('../log')('locations-view')
var textModal = require('../text-modal')
var view = require('../view')
var LocationSuggest = require('../location-suggest')
var extend = require('../../components/segmentio/extend/1.0.0')
var session = require('../session')
var evnt = require('component-event')

/**
 * Expose `View`
 */

var View = module.exports = view(require('./template.html'), function (view, plan) {
  plan.on('change', function (name) {
    view.resetIcons()

    if (name === 'from') view.find('#from-location').value = plan.from()
    if (name === 'to') view.find('#to-location').value = plan.to()

    /* if (session.user() && (name === 'from' || name === 'to')) {
      view.checkAddressFavorite(name)
    } */
  })

  view.on('rendered', function () {
    // Reset the icons
    view.resetIcons()

    // Set the initial state of the favorite icons
    /* if (session.user()) {
      view.checkAddressFavorite('from')
      view.checkAddressFavorite('to')
    } */

    // On form submission
    closest(view.el, 'form').onsubmit = function (e) {
      e.preventDefault()

      plan.setAddresses(view.find('.from input').value, view.find('.to input').value, function (err) {
        if (err) {
          log.error('%e', err)
        } else {
          plan.updateRoutes()
        }
      })
    }
  })
})

extend(View.prototype, LocationSuggest.prototype)

/**
 * Show clear or current location, but not both
 */

View.prototype.resetIcons = function (e) {
  showClearOrCurrentLocation(this, 'from')
  showClearOrCurrentLocation(this, 'to')

  function showClearOrCurrentLocation (view, name) {
    var selector = '.' + name
    var value = view.find(selector + ' input').value
    var refresh = view.find(selector + ' .findingCurrentLocation')
    var clear = view.find(selector + ' .clear')
    var location = view.find(selector + ' .currentLocation')

    refresh.classList.add('hidden')

    if (!value || !value.trim || value.trim().length === 0) {
      //clear.classList.add('hidden')
      //location.classList.remove('hidden')
    } else {
      //clear.classList.remove('hidden')
      //location.classList.add('hidden')
    }
  }
}

/**
 * Use the current location if it's available
 */

View.prototype.currentLocation = function (e) {
  e.preventDefault()
  this.findCurrentLocation(getInputGroupElement(e.target))
}

View.prototype.findCurrentLocation = function (el) {
  if ('geolocation' in navigator) {
    var name = el.classList.contains('from') ? 'from' : 'to'
    var input = this.find('.' + name + ' input')
    var self = this

    this.hideMenu()
    this.showIcon(name, 'findingCurrentLocation')

    navigator.geolocation.getCurrentPosition(function (position) {
      var c = position.coords
      input.value = c.longitude + ', ' + c.latitude
      self.save(input)
    }, function (err) {
      console.error(err)
      self.resetIcons()
      window.alert('Whoops! We were unable to find your current location.')
      self.showIcon(name, 'currentLocation')
    }, {
      enableHighAccuracy: true, // use GPS if available
      maximumAge: 60000, // 60 seconds
      timeout: 30000 // 30 seconds
    })
  } else {
    window.alert('Whoops! Looks like GPS location not available on this device.')
  }
}

View.prototype.locationSelected = function (target, val) {
  if (val === 'Current Location') {
    this.findCurrentLocation(getInputGroupElement(target))
  }
  this.save(target)
}

/**
 * Geocode && Save
 */

View.prototype.save = function (el) {
  var plan = this.model
  var name = el.name
  var val = el.value
  var self = this

  if (val && plan[name]() !== val) {
    analytics.track('Location Found', {
      address: val,
      type: name
    })
    this.model.setAddress(name, val, function (err, location) {
      if (err) {
        log.error('%e', err)
        textModal('Invalid address.')
      } else if (location) {
        self.showIcon(name, 'menu')
        plan.updateRoutes()
      }
    })
  }

  this.resetIcons()
}

/**
 * Highlight the selected input
 */

View.prototype.focusInput = function (e) {
  e.target.parentNode.classList.add('highlight')
}

/**
 * Clear
 */

View.prototype.clear = function (e) {
  e.preventDefault()

  var target = getInputGroupElement(e.target)

  var name = target.classList.contains('from') ? 'from' : 'to'
  var inputGroup = this.find('.' + name) // e.target.parentNode
  var input = inputGroup.getElementsByTagName('input')[0]
  input.value = ''
  input.focus()

  this.showIcon(name, 'currentLocation')
  this.hideMenu()
}

View.prototype.showIcon = function (parent, icon) {
  var icons = ['clear', 'cancel', 'currentLocation', 'findingCurrentLocation', 'menu']
  for (var i = 0; i < icons.length; i++) {
    if (icon === icons[i]) {
      this.find('.' + parent + ' .' + icons[i]).classList.remove('hidden')
    } else {
      this.find('.' + parent + ' .' + icons[i]).classList.add('hidden')
    }
  }
}

View.prototype.toggleFavorite = function (e) {
  if (!session.user()) {
    // TODO: encourage user to register?
    return
  }

  var type = e.target.parentNode.classList.contains('from') ? 'from' : 'to'
  var address = this.model.get(type)

  if (e.target.classList.contains('fa-heart-o')) {
    session.user().addFavoritePlace(address)
    session.user().saveCustomData(function () {})
    this.checkAddressFavorite(type)
  }
}

View.prototype.checkAddressFavorite = function (type) {
  var el = this.find('.' + type + '-favorite')
  if (session.user().isFavoritePlace(this.model.get(type))) {
    enableFavoriteIcon(el)
    el.title = 'Added to favorite places'
  } else {
    disableFavoriteIcon(el)
    el.title = 'Add to favorite places'
  }
}

View.prototype.dropdown = function (e) {
  this.showMenu(e)
}

View.prototype.showMenu = function (e) {
  var name = e.target.parentNode.classList.contains('from') ? 'from' : 'to'

  var menu = this.find('.lmenu-' + name)
  if (menu.classList.contains('hidden')) {
    menu.classList.remove('hidden')
    evnt.bind(document.documentElement, 'click', this.hideMenu.bind(this))
  } else {
    this.hideMenu()
  }
}

View.prototype.hideMenu = function () {
  this.find('.lmenu-from').classList.add('hidden')
  this.find('.lmenu-to').classList.add('hidden')
  evnt.unbind(document.documentElement, 'click', this.hideMenu.bind(this))
}

View.prototype.exploreCFNM = function (e) {
  this.hideMenu()
  var name = e.target.parentNode.classList.contains('from') ? 'from' : 'to'
  var ll = this.model.get(name + '_ll')
  var url = `http://www.carfreenearme.com/dashboard.cfm?cfnmLat=${ll.lat}&cfnmLon=${ll.lng}&cfnmRadius=0.125#map:art:metrobus:metrorail:cabi:car2go`
  window.open(url, '_blank')
}

View.prototype.renderingSuggestions = function (el) {
  var target = getInputGroupElement(el)
  var name = target.classList.contains('from') ? 'from' : 'to'
  this.showIcon(name, 'cancel')
}

View.prototype.searchCanceled = function (el) {
  var target = getInputGroupElement(el)
  var name = target.classList.contains('from') ? 'from' : 'to'
  this.showIcon(name, 'menu')
}

View.prototype.cancelSearch = function (e) {
  var target = getInputGroupElement(e.target)
  var name = target.classList.contains('from') ? 'from' : 'to'
  var input = this.find('#' + name + '-location')
  this.cancel(input)
}

function enableFavoriteIcon (el) {
  el.classList.remove('fa-heart-o')
  el.classList.add('fa-heart')
}

function disableFavoriteIcon (el) {
  el.classList.remove('fa-heart')
  el.classList.add('fa-heart-o')
}

function getInputGroupElement (el) {
  while (!el.classList.contains('input-group')) {
    el = el.parentNode
  }
  return el
}
