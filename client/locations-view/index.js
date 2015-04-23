var closest = require('closest')
var each = require('each')
var geocode = require('geocode')
var hogan = require('hogan.js')
var log = require('./client/log')('locations-view')
var textModal = require('text-modal')
var view = require('view')

/**
 * Expose `View`
 */

var View = module.exports = view(require('./template.html'), function (view, plan) {
  view.on('rendered', function () {
    // Reset the icons
    view.resetIcons()

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
      clear.classList.add('hidden')
      location.classList.remove('hidden')
    } else {
      clear.classList.remove('hidden')
      location.classList.add('hidden')
    }
  }
}

/**
 * Use the current location if it's available
 */

View.prototype.currentLocation = function (e) {
  e.preventDefault()
  if ('geolocation' in navigator) {
    var name = e.target.parentNode.classList.contains('from') ? 'from' : 'to'
    var input = this.find('.' + name + ' input')
    var self = this

    e.target.classList.add('hidden')
    this.find('.' + name + ' .findingCurrentLocation').classList.remove('hidden')

    navigator.geolocation.getCurrentPosition(function (position) {
      var c = position.coords
      input.value = c.longitude + ', ' + c.latitude
      self.save(input)
    }, function (err) {
      console.error(err)
      self.resetIcons()
      window.alert('Whoops! We were unable to find your current location.')
    }, {
      enableHighAccuracy: true,  // use GPS if available
      maximumAge: 60000, // 60 seconds
      timeout: 30000  // 30 seconds
    })
  } else {
    window.alert('Whoops! Looks like GPS location not available on this device.')
  }
}

/**
 * Address Changed
 */

View.prototype.blurInput = function (e) {
  log('input blurred, saving changes')

  var inputGroup = e.target.parentNode
  var suggestionList = inputGroup.getElementsByTagName('ul')[0]
  inputGroup.classList.remove('suggestions-open')

  var highlight = this.find('.suggestion.highlight')
  if (highlight) e.target.value = highlight.textContent || ''

  suggestionList.classList.add('empty')

  setTimeout(function () {
    suggestionList.innerHTML = ''
  }, 250)

  inputGroup.classList.remove('highlight')

  this.save(e.target)
}

/**
 * Keypress
 */

View.prototype.keydownInput = function (e) {
  var el = e.target
  var key = e.keyCode

  // Currently highlighted suggestion
  var highlightedSuggestion = this.find('.suggestion.highlight')

  switch (key) {
    case 13: // enter key
      e.preventDefault()
      this.blurInput(e)
      break
    case 38: // up key
    case 40: // down key
      if (key === 38) {
        this.pressUp(highlightedSuggestion, el)
      } else {
        this.pressDown(highlightedSuggestion, el)
      }

      var newHighlight = this.find('.suggestion.highlight')
      if (newHighlight) el.value = newHighlight.textContent || ''
      break
  }
}

/**
 * Press Up
 */

View.prototype.pressUp = function (highlightedSuggestion, el) {
  if (highlightedSuggestion) {
    var aboveHighlightedSuggestion = highlightedSuggestion.previousElementSibling

    if (aboveHighlightedSuggestion) {
      aboveHighlightedSuggestion.classList.add('highlight')
    } else {
      el.value = this.currentLocation || ''
      setCursor(el, el.value.length)
    }
    highlightedSuggestion.classList.remove('highlight')
  }
}

/**
 * Press Down
 */

View.prototype.pressDown = function (highlightedSuggestion, el) {
  if (!highlightedSuggestion) {
    var suggestion = this.find('.suggestion')
    if (suggestion) suggestion.classList.add('highlight')
  } else if (highlightedSuggestion.nextElementSibling) {
    highlightedSuggestion.nextElementSibling.classList.add('highlight')
    highlightedSuggestion.classList.remove('highlight')
  }
}

/**
 * Geocode && Save
 */

View.prototype.save = function (el) {
  var plan = this.model
  var name = el.name
  var val = el.value

  if (val && plan[name]() !== val) {
    this.model.setAddress(name, val, function (err, location) {
      if (err) {
        log.error('%e', err)
        textModal('Invalid address.')
      } else if (location) {
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
 * Suggestions Template
 */

var suggestionsTemplate = hogan.compile(require('./suggestions.html'))

/**
 * Suggest
 */

View.prototype.suggest = function (e) {
  var input = e.target
  var text = input.value || ''
  var inputGroup = input.parentNode
  var suggestionList = inputGroup.getElementsByTagName('ul')[0]
  var view = this

  // If the text is too short or does not contain a space yet, return
  if (text.length < 4 || text.indexOf(' ') === -1 || text.lastIndexOf(' ') + 1 ===
    text.length) return

  // Get a suggestion!
  geocode.suggest(text, function (err, suggestions) {
    if (err) {
      log.error('%e', err)
    } else {
      if (suggestions && suggestions.length > 0) {
        suggestions = suggestions.slice(0, 4)

        suggestionList.innerHTML = suggestionsTemplate.render({
          suggestions: suggestions
        })

        each(view.findAll('.suggestion'), function (li) {
          li.onmouseover = function (e) {
            li.classList.add('highlight')
          }

          li.onmouseout = function (e) {
            li.classList.remove('highlight')
          }
        })

        suggestionList.classList.remove('empty')
        inputGroup.classList.add('suggestions-open')
      } else {
        suggestionList.classList.add('empty')
        inputGroup.classList.remove('suggestions-open')
      }
    }
  })
}

/**
 * Clear
 */

View.prototype.clear = function (e) {
  e.preventDefault()
  var inputGroup = e.target.parentNode
  var input = inputGroup.getElementsByTagName('input')[0]
  input.value = ''
  input.focus()

  this.resetIcons()
}

/**
 * Set cursor
 */

function setCursor (node, pos) {
  node = (typeof node === 'string' || node instanceof String) ? document.getElementById(node) : node

  if (!node) return

  if (node.createTextRange) {
    var textRange = node.createTextRange()
    textRange.collapse(true)
    textRange.moveEnd(pos)
    textRange.moveStart(pos)
    textRange.select()
  } else if (node.setSelectionRange) {
    node.setSelectionRange(pos, pos)
  }

  return false
}
