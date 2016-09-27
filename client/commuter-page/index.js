var alerts = require('../alerts')
var config = require('../config')
var debug = require('debug')(config.name() + ':commuter-page')
var map = require('../map')
var page = require('page')
var request = require('../request')
var template = require('./template.html')
var view = require('../view')
var moment = require('moment')

var ConfirmModal = require('../confirm-modal')
var CommuterLocation = require('../commuter-location')

/**
 * Create `View`
 */

var View = view(template)

/**
 * Expose `render`
 */

module.exports = function (ctx, next) {
  debug('render')
  if (ctx.params.commuter === 'new' || !ctx.commuter) return
  CommuterLocation.forCommuter(ctx.commuter.get('_id'), function (err, commuterLocations) {
    if (err) {
      console.error(err)
    }

    var clModels = commuterLocations.map(function (cl) {
      var clModel = {
        clId: cl._id,
        organizationId: cl._location.get('created_by'),
        locationId: cl._location.get('_id'),
        name: cl._location.get('name'),
        fullAddress: cl._location.get('address'), // + ', ' + cl._location.get('city') + ', ' + cl._location.get('state'),
        matches: cl.matches,
        commuterAddress: cl._commuter.address,
        profile: []
      }

      if (cl.profile && cl.profile.options) {
        var options = cl.profile.options.map(function (option) {
          if (option.transit) {
            var icons = [ modeToIcon(option.access[0].mode), 'keyboard_arrow_right' ]
            icons = icons.concat(option.transit.map(function (t) { return modeToIcon(t.mode) }))
            return {
              access: option.access[0].mode,
              transit: option.transit.map(function (t) { return t.mode }),
              time: option.stats.avg,
              icons: icons
            }
          } else if (option.access) {
            // non-transit options
            return option.access.map(function (access) {
              return {
                access: access.mode,
                time: access.time,
                icons: [ modeToIcon(access.mode) ]
              }
            })
          }
        })
      }
      clModel.profile = [].concat.apply([], options).filter(function (option) { return option !== undefined })

      return clModel
    })

    ctx.view = new View(ctx.commuter, {
      organization: ctx.organization,
      commuterLocations: clModels
    })

    ctx.view.on('rendered', function (view) {
      if (ctx.commuter.validCoordinate()) {
        var m = window.map = map(view.find('.map'), {
          center: ctx.commuter.coordinate(),
          zoom: 13
        })

        m.addMarker(ctx.commuter.mapMarker())

        commuterLocations.forEach(function (cl) {
          m.addLayer(cl._location.mapMarker())
          cl.matches.forEach(function (match) {
            var coord = match.commuter.coordinate
            m.addLayer(map.createMarker({
              color: '#888',
              coordinate: [coord.lng, coord.lat],
              icon: 'user'
            }))
          })
        })
        // m.fitLayer(m.featureLayer)
      }
    })

    next()
  })
}

// convert mode to Material icon key
function modeToIcon (mode) {
  switch (mode) {
    case 'WALK': return 'directions_walk'
    case 'BUS': return 'directions_bus'
    case 'CAR': return 'directions_car'
    case 'CAR_PARK': return 'directions_car'
    case 'SUBWAY': return 'subway'
  }
  return 'none'
}

/**
 * Destroy
 */

View.prototype.destroy = function (e) {
  e.preventDefault()
  if (window.confirm('Delete commuter?')) { // eslint-disable-line no-alert
    var url = '/manager/organizations/' + this.model._organization() + '/show'
    this.model.destroy(function (err) {
      if (err) {
        debug(err)
        window.alert(err) // eslint-disable-line no-alert
      } else {
        alerts.push({
          type: 'success',
          text: 'Deleted commuter.'
        })
        page(url)
      }
    })
  }
}

/**
 * Send
 */

View.prototype.sendPlan = function (e) {
  e.preventDefault()
  if (window.confirm('Resend invitation to commuter?')) { // eslint-disable-line no-alert
    request.post('/commuters/' + this.model._id() + '/send-plan', {}, function (
      err, res) {
      if (err || !res.ok) {
        debug(err, res)
        window.alert('Failed to send plan.') // eslint-disable-line no-alert
      } else {
        alerts.show({
          type: 'success',
          text: 'Emailed plan to commuter.'
        })
      }
    })
  }
}

View.prototype.commuterName = function () {
  if (!this.model.givenName() && !this.model.surname()) return '(Unnamed Commuter)'
  return this.model.givenName() + ' ' + this.model.surname()
}

View.prototype.internalId = function () {
  return this.model.internalId() || '(none)'
}

View.prototype.organizationName = function () {
  return this.options.organization.name()
}

View.prototype.commuterLocations = function () {
  return this.options.commuterLocations
}

/** Profile option row **/

var OptionIcon = view(require('./icon.html'))

var ProfileOption = view(require('./option.html'))

ProfileOption.prototype.description = function () {
  if (!this.model.transit) return this.model.access
  return this.model.access + ' to ' + this.model.transit.join(',')
}

ProfileOption.prototype['icons-view'] = function () {
  return OptionIcon
}

ProfileOption.prototype.icons = function () {
  return this.model.icons.map(function (icon) {
    return {
      key: icon
    }
  })
}

ProfileOption.prototype.time = function () {
  var duration = moment.duration(this.model.time, 'seconds')
  var m = duration.minutes()
  var h = duration.hours()
  if (h > 0) return (h + ' hr. ' + m + ' min.')
  return m + ' min.'
}

/** Rideshare match row **/

var Match = view(require('./match.html'))

Match.prototype.organizationId = function () {
  return this.model.commuter._organization
}

Match.prototype.commuterId = function () {
  return this.model.commuter._id
}

Match.prototype.distanceMi = function () {
  return Math.round(this.model.distance * 100) / 100
}

Match.prototype.commuterName = function () {
  if (!this.model.givenName && !this.model.surname) return '(Unnamed Commuter)'
  return this.model.givenName + ' ' + this.model.surname
}

/** Location row **/

var LocationRow = view(require('./location.html'))

LocationRow.prototype['profile-view'] = function () {
  return ProfileOption
}

LocationRow.prototype['matches-view'] = function () {
  return Match
}

LocationRow.prototype.publicUrl = function () {
  return '/planner?from=' + encodeURIComponent(this.model.commuterAddress) + '&to=' + encodeURIComponent(this.model.fullAddress)
}

LocationRow.prototype.remove = function () {
  var self = this
  ConfirmModal({
    text: 'Are you sure want to remove this commuter from this location?'
  }, function () {
    CommuterLocation.remove(self.model.clId, function (err) {
      if (err) {
        console.error(err)
        window.alert(err)
      } else {
        self.el.remove()
      }
    })
  })
}

View.prototype['commuterLocations-view'] = function () {
  return LocationRow
}
