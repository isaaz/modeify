var config = require('../config')
var L = require('leaflet')
var debounce = require('debounce')
var session = require('../session')

var center = config.geocode().center.split(',').map(parseFloat)

var placeChanged = debounce(function (name, coordinate) {
  var plan = session.plan()
  plan.setAddress(name, coordinate.lng + ',' + coordinate.lat, function (err, rees) {
    if (err) console.error(err)
    else plan.updateRoutes()
  })
}, 150, true)

function constructMapboxUrl (tileset) {
  //TL Stop using Mapbox, stamen is a first replacement 24/05/2017
  /*
  var mapboxAccessToken = config.mapbox_access_token()
  var isRetina = window.devicePixelRatio > 1 ? '@2x' : ''
  return `https://api.mapbox.com/styles/v1/${tileset}/tiles/256/{z}/{x}/{y}${isRetina}?access_token=pk.eyJ1IjoiY29udmV5YWwiLCJhIjoiMDliQURXOCJ9.9JWPsqJY7dGIdX777An7Pw`
  */
  //return 'http://tile.stamen.com/terrain/{z}/{x}/{y}.png';
  //TL use g-ny without WMS 21/06/2017
  return 'http://carto.g-ny.org/gnybright/{z}/{x}/{y}.png';
}

module.exports = function (el) {
  try {
    var defaultBaseLayer
    var baseLayers = {}
    // create the map
    for(var i=0; i<Object.keys(config.baseLayers()).length; i++) {
      var layerConfig = config.baseLayers()["map" + i];
      var layerProps = { };
      if(layerConfig.attribution) layerProps['attribution'] = layerConfig.attribution;
      if(layerConfig.subdomains) layerProps['subdomains'] = layerConfig.subdomains;
      if(layerConfig.type) layerProps['type'] = layerConfig.type;
      var layer = new L.TileLayer(layerConfig.tileUrl, layerProps);
      baseLayers[layerConfig.name] = layer;
      if(i == 0) defaultBaseLayer = layer;           
      if(typeof layerConfig.getTileUrl != 'undefined') {
        layer.getTileUrl = layerConfig.getTileUrl;
      }
    }

    var mapProps = { 
      attributionControl: {
        compact: true,
        position: 'bottomleft'
      },
      layers  : [ defaultBaseLayer ],
      center : new L.LatLng(config.geocode().center.split(",")[0], config.geocode().center.split(",")[1]),
      zoomControl : false,
      inertia: false,
      zoomAnimation: false,
      minZoom: 11,
      maxZoom: 18
    }
    
    var map = new L.Map(el, mapProps).setView([center[1], center[0]], config.geocode().zoom);
    var layer_control = L.control.layers(baseLayers).addTo(map);
  } catch (err) {
    console.log(err)
  }

  map.doubleClickZoom.disable()
  map.on('dblclick', function (e) {
    var popupContent = document.createElement('div')
    popupContent.setAttribute('data-lat', e.latlng.lat)
    popupContent.setAttribute('data-lng', e.latlng.lng)

    popupContent.innerHTML = 'Set as: <span class="set-start"><span class="add-on icon-start"></span> Start</span> | <span class="set-end"><span class="icon-end"></span> End</span>'
    popupContent.getElementsByClassName('set-start')[0].onclick = function (e) {
      placeChanged('from', {
        lat: parseFloat(e.target.parentElement.dataset['lat']),
        lng: parseFloat(e.target.parentElement.dataset['lng'])
      })
      map.closePopup()
    }

    popupContent.getElementsByClassName('set-end')[0].onclick = function (e) {
      placeChanged('to', {
        lat: parseFloat(e.target.parentElement.dataset['lat']),
        lng: parseFloat(e.target.parentElement.dataset['lng'])
      })
      map.closePopup()
    }

    L.popup()
      .setLatLng(e.latlng)
      .setContent(popupContent)
      .openOn(map)
  })

  module.exports.polyline = function(polyline) {
    var polyline = L.polyline(polyline, {color: '#ff00ff'}).addTo(map);
  }

  module.exports.circle = function(polyline) {
    var polyline = L.circle(polyline, {color: 'blue', radius: 10}).addTo(map);
  } 

  return map
}
