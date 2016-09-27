var ConfirmModal = require('../confirm-modal')
var request = require('../request')

var View = require('../view')(require('./row.html'))

View.prototype.remove = function () {
  var self = this
  if (this.model.location_count() > 0) {
    ConfirmModal({
      text: 'Please delete all locations for this organization before deleting the organization.',
      showCancel: false
    })
  } else {
    ConfirmModal({
      text: 'Are you sure you want to delete the organization ' + this.model.name() + '?'
    }, function () {
      request.del('/organizations/' + self.model._id(), function (err) {
        if (err) {
          console.error(err)
          window.alert(err)
        } else {
          self.el.remove()
        }
      })
    })
  }
}

module.exports = View
