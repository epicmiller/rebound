// Rebound Data
// ----------------
// These are methods inherited by all Rebound data types: **Models**,
// **Collections** and **Computed Properties**. Controls tree ancestry
// tracking, deep event propagation and tree destruction.
import $ from "rebound-utils/rebound-utils";
import Path from "rebound-data/path";
import Events from "rebound-data/events";
import Data from "rebound-data/data";
import Value from "rebound-data/value";
import Model from "rebound-data/model";
import Collection from "rebound-data/collection";
import ComputedProperty from "rebound-data/computed-property";

// Underscore methods that we want to implement on the Model, mapped to the
// number of arguments they take.
const MODEL_METHODS = {
  keys: 1, values: 1, pairs: 1, invert: 1, pick: 0, omit: 0, chain: 1, isEmpty: 1
};

// Underscore methods that we want to implement on the Collection.
// 90% of the core usefulness of Rebound Collections is actually implemented
// right here:
const COLLECTION_METHODS = {
    forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
    foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
    select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
    /* contains: 3,*/ invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
    head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
    without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
    isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
    sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3
  };

// Proxy Rebound class methods to Underscore functions, wrapping the model's
// `attributes` object or collection's `models` array behind the scenes.
//
// collection.filter(function(model) { return model.get('age') > 10 });
// collection.each(this.addView);
//
// `Function#apply` can be slow so we use the method's arg count, if we know it.
var addMethod = function(length, method, attribute) {
  switch (length) {
    case 1: return function() {
      return _[method](this[attribute]);
    };
    case 2: return function(value) {
      return _[method](this[attribute], value);
    };
    case 3: return function(iteratee, context) {
      return _[method](this[attribute], cb(iteratee, this), context);
    };
    case 4: return function(iteratee, defaultVal, context) {
      return _[method](this[attribute], cb(iteratee, this), defaultVal, context);
    };
    default: return function() {
      var args = slice.call(arguments);
      args.unshift(this[attribute]);
      return _[method].apply(_, args);
    };
  }
};
// Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
var cb = function(iteratee, instance) {
  if (_.isFunction(iteratee)) return iteratee;
  if (_.isObject(iteratee) && !iteratee.isData) return modelMatcher(iteratee);
  if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
  return iteratee;
};
var modelMatcher = function(attrs) {
  var matcher = _.matches(attrs);
  return function(model) {
    return matcher(model.attributes);
  };
};
var addUnderscoreMethods = function(Class, methods, attribute) {
  _.each(methods, function(length, method) {
    if (_[method]) Class.prototype[method] = addMethod(length, method, attribute);
  });
};

// Mix in each Underscore method to its respective object
addUnderscoreMethods(Model, MODEL_METHODS, 'attributes');
addUnderscoreMethods(Collection, COLLECTION_METHODS, 'models');

// Set up our default data types.
Data.config('Object', Model);
Data.config('Array', Collection);
Data.config('Property', ComputedProperty);
Data.config('Value', Value);

export { Path as Path};
export { Events as Events };
export { Data as Data };
export { Value as Value };
export { Model as Model };
export { Collection as Collection };
export { ComputedProperty as ComputedProperty };
export default { Path, Events, Data, Value, Model, Collection, ComputedProperty };
