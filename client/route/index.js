var convert = require('convert');
var model = require('model');
var defaults = require('model-defaults');
var session = require('session');
var each = require('each');

/**
 * MPS to MPH
 */

var MPS_TO_MPH = 2.23694;

/**
 * Expose `Route`
 */

var Route = module.exports = model('Route')
  .use(defaults({
    costPenalty: false,
    costSavings: false,
    modes: [],
    timeSavings: false,
    transit: [],
    weightLost: false
  }))
  .attr('id')
  .attr('access')
  .attr('bikeCalories')
  .attr('bikeDistance')
  .attr('bikeTime')
  .attr('calories')
  .attr('cost')
  .attr('costPenalty')
  .attr('costSavings')
  .attr('driveDistance')
  .attr('egress')
  .attr('emissions')
  .attr('emissionsDifference')
  .attr('hasTransit')
  .attr('modes')
  .attr('score')
  .attr('stats')
  .attr('time')
  .attr('timeSavings')
  .attr('transfers')
  .attr('transitCost')
  .attr('transit')
  .attr('trips')
  .attr('walkCalories')
  .attr('walkDistance')
  .attr('walkTime')
  .attr('weightLost');

/**
 * Changes to emit on rescore
 */

var emitAfterRescore = ['average', 'bikeTime', 'calculatedCost', 'calculatedCalories', 'transitCosts', 'tripsPerYear',
  'carParkingCost', 'vmtRate', 'walkTime'
];

/**
 * Update scoring
 */

Route.prototype.rescore = function(scorer) {
  var data = scorer.processOption(this.toJSON());

  for (var i in data) {
    if (this.hasOwnProperty(i) && i !== 'transitCost') {
      this[i](data[i]);
    }
  }

  for (i in emitAfterRescore) {
    var attr = emitAfterRescore[i];
    this.emit('change ' + attr, this[attr]());
  }
};

/**
 * Set car data
 */

Route.prototype.setCarData = function(data) {
  var m = this.tripm();

  var costDifference = data.cost * m - this.cost() * m;
  var emissions = (data.emissions - this.emissions()) / data.emissions * 100;
  var timeSavings = (this.timeInTransit() - (data.time - this.time())) * m;

  if (this.directCar()) {
    costDifference = data.cost * m / 2;
    emissions = 50;
    timeSavings = this.average() * m / 2; // Assume split driving
  }

  if (costDifference > 0) {
    this.costSavings(costDifference);
  }

  if (this.calories() !== 0) {
    this.weightLost(parseInt(convert.caloriesToPounds(this.calories()) * m, 10));
  }

  if (timeSavings > 60) {
    this.timeSavings(parseInt(timeSavings / 60, 10));
  }

  if (emissions > 0) {
    this.emissionsDifference(parseInt(emissions, 10));
  }
};

/**
 * Direct car?
 */

Route.prototype.directCar = function() {
  return this.modes().length === 1 && this.hasCar();
};

/**
 * Is this a direct bike or walk journey?
 */

Route.prototype.directBikeOrWalk = function() {
  return !this.hasTransit() && !this.hasCar();
};

/**
 * Average trip length in minutes
 */

Route.prototype.average = function() {
  if (this.hasTransit() || this.modes().indexOf('car') === -1) {
    return Math.round(this.time());
  } else {
    return Math.round(this.time() * 1.35);
  }
};

/**
 * Freeflow
 */

Route.prototype.freeflowTime = function() {
  if (this.hasTransit() || this.modes().indexOf('car') === -1) {
    return false;
  } else {
    return Math.round(this.time());
  }
};

/**
 * Time in transit
 */

Route.prototype.timeInTransit = function() {
  if (!this.hasTransit()) {
    return 0;
  } else {
    return this.transit().reduce(function(m, t) {
      return m + t.waitStats.avg + t.rideStats.avg;
    }, 0) / 60;
  }
};

/**
 * Shorthand helpers
 */

Route.prototype.hasCost = function() {
  return this.cost() > 0;
};

Route.prototype.hasCar = function() {
  return this.modes().indexOf('car') !== -1;
};

Route.prototype.hasTransit = function() {
  return this.transit().length > 0;
};

Route.prototype.hasBiking = function() {
  return this.modes().indexOf('bicycle') !== -1;
};

Route.prototype.hasWalking = function() {
  return this.modes().indexOf('walk') !== -1;
};

/**
 * Days
 */

Route.prototype.tripsPerYear = function() {
  return session.plan().tripsPerYear();
};

/**
 * Trip multiplier
 */

Route.prototype.tripm = function() {
  return session.plan().tripsPerYear();
};

/**
 * Cost
 */

Route.prototype.calculatedCost = function() {
  if (this.cost() === 0) {
    return false;
  }

  var cost = 0;
  if (this.transitCost()) {
    cost += this.transitCost();
  }
  if (this.modes().indexOf('car') !== -1) {
    cost += this.vmtRate() * this.driveDistances();
    cost += this.carParkingCost();
  }

  var total = cost * this.tripm();
  if (total > 1000) {
    return toFixed(total / 1000, 1) + 'k';
  } else if (total > 100) {
    return parseInt(total, 10);
  } else {
    return total.toFixed(2);
  }
};

/**
 * Transit Cost
 */

Route.prototype.transitCosts = function() {
  if (!this.transitCost()) {
    return false;
  } else {
    return this.transitCost().toFixed(2);
  }
};

/**
 * Calories
 */

Route.prototype.calculatedCalories = function() {
  if (this.calories() === 0) {
    return false;
  }

  var cals = walkingCaloriesBurned(this.walkSpeed(), this.weight(), (this.walkDistances() / this.walkSpeed()));
  if (this.modes().indexOf('bicycle') !== -1) {
    cals += bikingCaloriesBurned(this.bikeSpeed(), this.weight(), (this.bikeDistances() / this.bikeSpeed()));
  }
  var total = cals * this.tripm();
  return total > 1000 ? toFixed(total / 1000, 1) + 'k' : total | 0;
};

/**
 * Frequency
 */

Route.prototype.frequency = function() {
  var trips = this.trips();
  if (!trips) {
    return false;
  }

  var plan = session.plan();
  var start = plan.start_time();
  var end = plan.end_time();

  return Math.round(60 / (trips / (end - start)));
};

/**
 * Walk/Bike distances rounded
 */

Route.prototype.driveDistances = function() {
  return this.distances('car', 'driveDistance');
};

Route.prototype.bikeDistances = function() {
  return this.distances('bicycle', 'bikeDistance');
};

Route.prototype.walkDistances = function() {
  return this.distances('walk', 'walkDistance');
};

Route.prototype.distances = function(mode, val) {
  if (this.modes().indexOf(mode) === -1) {
    return false;
  } else {
    return convert.metersToMiles(this[val]());
  }
};

/**
 * Walk/bike speed in MPH
 */

Route.prototype.bikeSpeedMph = function() {
  return toFixed(this.bikeSpeed() * MPS_TO_MPH, 1);
};

Route.prototype.walkSpeedMph = function() {
  return toFixed(this.walkSpeed() * MPS_TO_MPH, 1);
};

/**
 * Walk/bike time in minutes
 */

Route.prototype.bikeTime = function() {
  return timeFromSpeedAndDistance(this.bikeSpeed(), this.bikeDistance());
};

Route.prototype.walkTime = function() {
  return timeFromSpeedAndDistance(this.walkSpeed(), this.walkDistance());
};

function timeFromSpeedAndDistance(s, d) {
  var t = d / s;
  if (t < 60) {
    return '< 1';
  } else {
    return parseInt(t / 60, 10);
  }
}

/**
 * Retrieve from scorer
 */

Route.prototype.bikeSpeed = function() {
  return session.plan().scorer().rates.bikeSpeed;
};

Route.prototype.walkSpeed = function() {
  return session.plan().scorer().rates.walkSpeed;
};

Route.prototype.vmtRate = function() {
  return session.plan().scorer().rates.mileageRate;
};

Route.prototype.weight = function() {
  return session.plan().scorer().rates.weight;
};

Route.prototype.carParkingCost = function() {
  return session.plan().scorer().rates.carParkingCost;
};

/**
 * Construct a simple mode-based descriptor (e.g. "Drive to Transit")
 */

Route.prototype.modeDescriptor = function() {
  var modeStr;

  if (this.bikeDistance() > 0) {
    modeStr = 'bike';
  } else if (this.driveDistance() > 0) {
    modeStr = 'drive';
  } else {
    modeStr = 'walk';
  }

  if (this.hasTransit()) {
    modeStr += ' to transit';
  } else if (this.driveDistance() > 0) {
    modeStr = 'rideshare';
  }

  return modeStr;
};

/**
 * Walking Calories
 *
 * CB = [0.0215 x KPH3 - 0.1765 x KPH2 + 0.8710 x KPH + 1.4577] x WKG x T
 * http://www.shapesense.com/fitness-exercise/calculators/walking-calorie-burn-calculator.aspx
 */

function walkingCaloriesBurned(mps, wkg, hours) {
  var kph = mps / 1000 * 60 * 60;
  var kph2 = kph * kph;
  var kph3 = kph2 * kph;
  return (0.0215 * kph3 - 0.1765 * kph2 + 0.8710 * kph) * wkg * hours;
}

/**
 * Biking Calories
 *
 * http://en.wikipedia.org/wiki/Bicycle_performance
 */

var GRADE = 1;
var GRAVITY = 9.8;
var K1 = 0.0053; // frictional losses
var K2 = 0.185; // aerodynamic drag
var WATTS_TO_CALS_PER_SECOND = 0.2388;

function bikingCaloriesBurned(mps, wkg, hours) {
  var mps3 = Math.pow(mps, 3);
  var seconds = hours * 60 * 60;
  var watts = GRAVITY * wkg * mps * (K1 + GRADE) + K2 * mps3;
  return watts * WATTS_TO_CALS_PER_SECOND * seconds;
}

function toFixed(n, f) {
  var m = Math.pow(10, f);
  return ((n * m) | 0) / m;
}


/**
 * Tags
 */

Route.prototype.tags = function(plan) {
  // start with the mode tags
  var tags = this.modes();
  if(this.hasTransit()) tags.push('transit');

  // add tags for each transit route agency id
  each(this.transit(), function(transitLeg) {
    if(transitLeg.routes.length > 0) {
      tags.push(transitLeg.routes[0].id.split(':')[0]);
    }
  });

  // add tags for the from/to locations
  if(plan) {
    var from = locationToTags(plan.from());
    var to = locationToTags(plan.to());
    tags = tags.concat(from).concat(to);
  }

  tags = tags.map(function(tag) { return tag.toLowerCase().trim(); });
  return tags;
};


function locationToTags(location) {
  // strip off the zip code, if present
  var endsWithZip = /\d{5}$/;
  if(endsWithZip.test(location)) {
    location = location.substring(0, location.length - 5);
  }
  return location.split(',').slice(1);
}