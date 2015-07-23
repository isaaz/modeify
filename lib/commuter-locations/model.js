import Commuter from '../commuter/model'
import later from '../later'
import mongoose from '../mongo'
import log from '../log'
import { profileCommuterLocations, matchCommuterLocations } from './profile'

const Schema = mongoose.Schema

const schema = new Schema({
  _location: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  _commuter: {
    type: Schema.Types.ObjectId,
    ref: 'Commuter',
    required: true
  },
  profile: Object,
  profiled: Date,
  profileOptions: Object,
  matches: [Schema.Types.ObjectId], // Commuter Ids
  matched: Date
})

/**
 * Find commuters and profiles based on a location
 */

schema.statics.findCommutersAndProfiles = function (_location) {
  return new Promise((resolve, reject) => {
    this.find()
      .where('_location', _location)
      .populate('_commuter _location')
      .exec()
      .then((cls) => {
        Promise.all(cls.map(cl => {
          return cl._commuter
            .populate('_user')
            .execPopulate()
        })).then(() => {
          resolve(cls)
        }, reject)
      }, reject)
  })
}

schema.statics.addCommuters = function (commuters) {
  return Promise.all(commuters.map((c) => {
    const name = (c._commuter.name || '').split(' ')
    return Commuter
      .generate({
        email: c._commuter.email
      }, {
        address: c._commuter.address,
        name: {
          first: name[0],
          last: name[1]
        }
      })
      .then((commuter) => {
        return this.create({
          _commuter: commuter._id,
          _location: c._location
        })
      })
  }))
}

schema.statics.profileAndMatch = function (commuterLocations) {
  later(() => {
    log.info('start profiling and matching')
    Promise.all([profileCommuterLocations(commuterLocations), matchCommuterLocations(commuterLocations)])
      .then(() => {
        log.info('profiling and matching successful')
        return Promise.all(commuterLocations.map(cl => cl.save()))
      })
      .catch((err) => {
        log.error('profiling and matching failed', err)
      })
  })
  return Promise.resolve('started')
}

const CommuterLocation = mongoose.model('CommuterLocation', schema)

export default CommuterLocation