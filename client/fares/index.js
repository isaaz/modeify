var fares = require('./fares.json')

var CHANGE_PARKING_PRICE_ROUNDTRIP = fares.parking.increaseRoundTrip

if (!fares.parking.dailyRoundTrip){
    fares.parking.dailyRoundTrip = fares.parking.daily * CHANGE_PARKING_PRICE_ROUNDTRIP
}
if (!fares.parking.yearlyRoundTrip){
    fares.parking.yearlyRoundTrip = fares.parking.yearly
}
/**
 * expose fares
 */
module.exports = fares

module.exports.setValues = function (values){
    fares.parking.daily=values.carParkingCost
    fares.parking.dailyRoundTrip = fares.parking.daily * CHANGE_PARKING_PRICE_ROUNDTRIP
    fares.parking.yearly=values.carParkingCostYearly
    fares.parking.yearlyRoundTrip=values.carParkingCostYearly
    fares.carCostPerMile=values.carCostPerMiles
}