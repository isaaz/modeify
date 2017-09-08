var pollution = require('./pollution.json')

var myCar = "diesel"
var speedBus = 4.2 // environ 15km/h
var speedTed = 10 // 36km/h
var speedSub = 5.6 // environ 20km/h
var speedTrain = 25 //90km/h

module.exports.setCar = function(value){
    myCar = value
}

module.exports.getCarCO2Pollution = function(route){
    var distance = route.driveDistance()
    return pollution.co2.voiture[myCar] * distance / 1000
}

module.exports.getTrainCO2Pollution = function(route){
    return route.attrs.timeInTrain ? pollution.co2.train * speedTrain * route.attrs.timeInTrain / 1000 : 0
}

module.exports.getBusCO2Pollution = function(route){
    return route.attrs.timeInBus ? pollution.co2.bus * speedBus * route.attrs.timeInBus / 1000 : 0
}

module.exports.getCoachCO2Pollution = function(route){
    var result = 0
    if (route.attrs.timeInSub) result += pollution.co2.coach * speedSub * route.attrs.timeInSub / 1000
    if (route.attrs.timeInTed) result += pollution.co2.coach * speedTed * route.attrs.timeInTed / 1000
    return result
}

module.exports.getCarNOxPollution = function(route){
    var distance = route.driveDistance()
    return pollution.nox.voiture[myCar] * distance / 1000
}

module.exports.getTrainNOxPollution = function(route){
    return route.attrs.timeInTrain ? pollution.nox.train * speedTrain * route.attrs.timeInTrain / 1000 : 0
}

module.exports.getBusNOxPollution = function(route){
    return route.attrs.timeInBus ? pollution.nox.bus * speedBus * route.attrs.timeInBus / 1000 : 0
}

module.exports.getCoachNOxPollution = function(route){
    var result = 0
    if (route.attrs.timeInSub) result += pollution.nox.coach * speedSub * route.attrs.timeInSub / 1000
    if (route.attrs.timeInTed) result += pollution.nox.coach * speedTed * route.attrs.timeInTed / 1000
    return result
}

module.exports.getCarPM10Pollution = function(route){
    var distance = route.driveDistance()
    return pollution.pm10.voiture[myCar] * distance / 1000
}

module.exports.getTrainPM10Pollution = function(route){
    return route.attrs.timeInTrain ? pollution.pm10.train * speedTrain * route.attrs.timeInTrain / 1000 : 0
}

module.exports.getBusPM10Pollution = function(route){
    return route.attrs.timeInBus ? pollution.pm10.bus * speedBus * route.attrs.timeInBus / 1000 : 0
}

module.exports.getCoachPM10Pollution = function(route){
    var result = 0
    if (route.attrs.timeInSub) result += pollution.pm10.coach * speedSub * route.attrs.timeInSub / 1000
    if (route.attrs.timeInTed) result += pollution.pm10.coach * speedTed * route.attrs.timeInTed / 1000
    return result
}