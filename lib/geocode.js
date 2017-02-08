const express = require('express')
const superagent = require('superagent')

const config = require('./config')

var center = config.geocode.center.split(',').map(parseFloat)

var proximity = {
  latitude: center[1],
  longitude: center[0]
}

const apiKey = config.mapzen.search.api_key
const mapzenUrl = 'https://search.mapzen.com/v1'

const reverseUrl = `${mapzenUrl}/reverse`
const searchUrl = `${mapzenUrl}/search`

/**
 * Expose `router`
 */

var router = module.exports = express.Router()

/**
 * Expose `encode` & `reverse`
 */

module.exports.encode = encode
module.exports.reverse = reverse
module.exports.suggest = suggest

/**
 * Geocode
 */

router.get('/:address', function (req, res) {
  encode(req.params.address, function (err, addresses) {
    if (err) {
      res.status(400).send(err)
    } else {
      res.status(200).send(addresses[0].coordinate)
    }
  })
})

/**
 * Geocode
 */

router.get('/extended/:address', function (req, res) {
  encode(req.params.address, function (err, addresses) {
    if (err) {
      res.status(400).send(err)
    } else {
      res.status(200).send(addresses[0])
    }
  })
})

/**
 * Reverse
 */

router.get('/reverse/:coordinate', function (req, res) {
  reverse(req.params.coordinate, function (err, address) {
    if (err) {
      res.status(400).send(err)
    } else {
      res.status(200).send(address)
    }
  })
})

/**
 * Suggest
 */

router.get('/suggest/:text', function (req, res) {
  suggest(req.params.text, function (err, suggestions) {
    if (err) {
      res.status(400).send(err)
    } else {
      res.status(200).send(suggestions)
    }
  })
})

/**
 * Geocode
 */

function encode (address, callback) {
  if (address.address) {
    address = address.address + ', ' + address.city + ', ' + address.state + ' ' +
      address.zip
  }

  // check for intersection query
  if (isIsect(address)) {
    hereIsect(address, (err, res) => {
      if (err) {
        callback(err, res)
      } else {
        callback(null, res.map(hereSplitFeature))
      }
    })
    return
  }

  var query = {
    api_key: apiKey,
    'boundary.country': 'USA',
    'focus.point.lat': proximity.latitude,
    'focus.point.lon': proximity.longitude,
    text: address
  }

  if (config.geocode.boundary_rect) {
    query['boundary.rect.min_lat'] = config.geocode.boundary_rect.min_lat
    query['boundary.rect.min_lon'] = config.geocode.boundary_rect.min_lon
    query['boundary.rect.max_lat'] = config.geocode.boundary_rect.max_lat
    query['boundary.rect.max_lon'] = config.geocode.boundary_rect.max_lon
  }

  superagent
    .get(searchUrl)
    .query(query)
    .end((err, response) => {
      if (err) {
        callback(err, response)
      } else if (!response.body.features || response.body.features.length < 1) {
        callback('Address not found.')
      } else {
        callback(null, response.body.features.map(splitFeature))
      }
    })
}

/**
 * Reverse geocode
 */

function reverse (ll, callback) {
  var location = ll
  if (typeof ll === 'string') {
    ll = ll.split(',')
  }

  if (ll.lng || ll.lon) {
    location = {
      longitude: ll.lng || ll.lon,
      latitude: ll.lat
    }
  } else if (ll.x) {
    location = {
      longitude: ll.x,
      latitude: ll.y
    }
  } else if (Array.isArray(ll)) {
    location = {
      longitude: ll[0],
      latitude: ll[1]
    }
  }

  superagent
    .get(reverseUrl)
    .query({
      api_key: apiKey,
      'boundary.country': 'USA',
      'point.lat': location.latitude,
      'point.lon': location.longitude
    })
    .end((err, response) => {
      if (err) {
        callback(err)
      } else if (!response.body.features || response.body.features.length < 1) {
        callback('Coordinates not found.')
      } else {
        callback(null, splitFeature(response.body.features[0]))
      }
    })
}

/**
 * Auto suggest
 */

function suggest (text, callback) {
  // check for intersection query
  if (isIsect(text)) {
    hereIsect(text, (err, res) => {
      if (err) {
        callback(err, res)
      } else {
        callback(null, res.map(hereSplitSuggest))
      }
    })
    return
  }

  var query = {
    api_key: apiKey,
    'boundary.country': 'USA',
    'focus.point.lat': proximity.latitude,
    'focus.point.lon': proximity.longitude,
    text
  }

  if (config.geocode.boundary_rect) {
    query['boundary.rect.min_lat'] = config.geocode.boundary_rect.min_lat
    query['boundary.rect.min_lon'] = config.geocode.boundary_rect.min_lon
    query['boundary.rect.max_lat'] = config.geocode.boundary_rect.max_lat
    query['boundary.rect.max_lon'] = config.geocode.boundary_rect.max_lon
  }

  superagent
    .get(searchUrl)
    .query(query)
    .end((err, response) => {
      if (err) {
        callback(err, response)
      } else {
        callback(null, response.body.features.map(f => {
          return {
            id: f.properties.id,
            text: `${f.properties.label} ${f.properties.postalcode}`,
            center: f.geometry.coordinates
          }
        }))
      }
    })
}

function splitFeature ({geometry, properties}) {
  const zip = properties.postalcode ? parseInt(properties.postalcode, 10) : undefined
  return {
    address: `${properties.label} ${zip}`,
    city: properties.locality,
    state: properties.region,
    zip,
    country: properties.country,
    coordinate: {
      lat: geometry.coordinates[1],
      lng: geometry.coordinates[0]
    }
  }
}

/** here/intersection functions **/

function hereIsect (text, callback) {
  const hereUrl = 'https://geocoder.cit.api.here.com/6.2/geocode.json'
  var query = {
    app_id: config.here.app_id,
    app_code: config.here.app_code,
    gen: 9,
    searchtext: text
  }

  if (config.geocode.boundary_rect) {
    query.bbox = `${config.geocode.boundary_rect.max_lat},${config.geocode.boundary_rect.min_lon};${config.geocode.boundary_rect.min_lat},${config.geocode.boundary_rect.max_lon}`
  }

  superagent
    .get(hereUrl)
    .query(query)
    .end((err, response) => {
      if (err) {
        callback(err, response)
      } else {
        if (!response.body.Response.View || response.body.Response.View.length === 0 || !response.body.Response.View[0].Result) {
          callback(null, [])
        } else {
          var results = response.body.Response.View[0].Result
          results = results.filter(r => {
            return r.MatchLevel === 'intersection'
          })
          callback(null, results)
        }
      }
    })
}

function hereSplitSuggest (result) {
  return {
    id: result.Location.LocationId,
    text: result.Location.Address.Label,
    center: [ result.Location.DisplayPosition.Longitude, result.Location.DisplayPosition.Latitude ]
  }
}

function hereSplitFeature (result) {
  return {
    address: result.Location.Address.label,
    city: result.Location.Address.City,
    state: result.Location.Address.State,
    zip: result.Location.Address.PostalCode,
    country: result.Location.Address.Country,
    coordinate: {
      lat: result.Location.DisplayPosition.Latitude,
      lng: result.Location.DisplayPosition.Longitude
    }
  }
}

function isIsect (address) {
  return address.indexOf('@') !== -1 || address.indexOf('&') !== -1 || address.indexOf('and') !== -1
}
