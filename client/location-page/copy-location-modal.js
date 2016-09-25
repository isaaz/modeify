var alerts = require('../alerts')
var CommuterLocation = require('../commuter-location')
var each = require('component-each')
var log = require('../log')('location-page:modal')
var value = require('component-value')
var view = require('../view')
var ConfirmModal = require('../confirm-modal')
var Location = require('../location')

/**
 * Modal
 */

var Modal = module.exports = view(require('./copy-location-modal.html'), function (model, opts) {
  console.log('copy modal2');
})

var LocationRow = view(require('./copy-location-modal-row.html'))

/**
 * Inputs
 */

Modal.prototype['locations-view'] = function () {
  return LocationRow
}

/**
 * Close
 */

Modal.prototype.close = function (e) {
  e.preventDefault()
  this.el.remove()
}

Modal.prototype.continue = function (e) {
  e.preventDefault()
  this.el.remove()

  var locationIds = []
  each(this.findAll('tr'), function (el) {
    if (!el.querySelector('.confirm')) return
    // if confirm is unchecked, skip
    console.log(value(el.querySelector('.confirm')))
    if (!value(el.querySelector('.confirm'))) return

    // get the other data
    locationIds.push(el.querySelector('.id').value)
  })

  console.log(locationIds)
  this.options.onContinue(locationIds)
}
