import { $, Path, REBOUND_SYMBOL } from "rebound-utils/rebound-utils";
import _hooks from "rebound-htmlbars/hooks";

var RENDER_TIMEOUT;

function reslot(env){

  // Fix for stupid Babel module importer
  // TODO: Fix this. This is dumb. Modules don't resolve in by time of this file's
  // execution because of the dependancy tree so babel doesn't get a chance to
  // interop the default value of these imports. We need to do this at runtime instead.
  var hooks = _hooks.default || _hooks;

  var outlet,
      slots = env.root.options && env.root.options[REBOUND_SYMBOL];

  // If we have no data, or no slots to re-render into, exit
  if(!env.root || !slots){ return; }

  // Walk the dom, without traversing into other custom elements, and search for
  // `<content>` outlets to render templates into.
  $(env.root.el).walkTheDOM(function(el){
    if(env.root.el === el){ return true; }
    if(el.tagName === 'CONTENT'){ outlet = el; }
    if(el.tagName.indexOf('-') > -1){ return false; }
    return true;
  });

  // If a `<content>` outlet is present in component's template, and a template
  // is provided, render it into the outlet
  if(slots.templates.default && _.isElement(outlet) && !outlet.slotted){
    outlet.slotted = true;
    $(outlet).empty();
    outlet.appendChild(hooks.buildRenderResult(slots.templates.default, slots.env, slots.scope, {}).fragment);
  }
}

// Listens for `change` events and calls `trigger` with the correct values
function onChange(model, options){
  trigger.call(this, model.__path(), model.changedAttributes());
}

// Listens for `reset` events and calls `trigger` with the correct values
function onReset(data, options){
  trigger.call(this, data.__path(), data.isModel ? data.changedAttributes() : { '@each': data }, options);
}

// Listens for `update` events and calls `trigger` with the correct values
function onUpdate(collection, options){
  trigger.call(this, collection.__path(), { '@each': collection }, options);
}


function ProcessQueue(func){
  this.NextSymbol = '__Rebound_Process_Queue_Symbol__';
  this.length = 0;
  this.cache = {};
  this.func = func;
  this.first = null;
  this.last = null;
  this.processing = false;
}

ProcessQueue.prototype.add = function add(arr){
  var i, obj, len = arr.length;
  for(i=0;i<len;i++){
    obj = arr[i];
    obj.makeDirty && obj.makeDirty();
    if(!obj || this.cache[obj.cid]){ continue; }
    this.cache[obj.cid] = ++this.length;
    this.last && (this.last[this.NextSymbol] = obj);
    this.last = obj[this.NextSymbol] = obj;
    !this.first && (this.first = obj);
  }
};

ProcessQueue.prototype.process = function process(){
  var len = this.length;
  while(this.first && len--){
    delete this.cache[this.first.cid];
    var prev = this.first;
    this.first = prev[this.NextSymbol];
    delete prev[this.NextSymbol];
    this.func(prev);
  }
  if(this.first === this.last){ this.first = this.last = null; }
};

const TO_RENDER = new ProcessQueue(function(item){ item.notify(); });
const ENV_QUEUE = new ProcessQueue(function(env){
  for(let key in env.revalidateQueue){
    env.revalidateQueue[key].revalidate();
  }
  reslot(env);
});


// Called on animation frame. TO_RENDER is a list of lazy-values to notify.
// When notified, they mark themselves as dirty. Then, call revalidate on all
// dirty expressions for each environment we need to re-render. Use `while(queue.length)`
// to accomodate synchronous renders where the render queue callbacks may trigger
// nested calls of `renderCallback`.
function renderCallback(){
  RENDER_TIMEOUT = null;
  TO_RENDER.process();
  ENV_QUEUE.process();
}

function trigger(basePath, changed, options={}){

  // If nothing has changed, exit.
  if(!changed){ return void 0; }

  // If this event came from within a service, include the service key in the base path
  if(options.service){ basePath = options.service + '.' + basePath; }

  // Replace any array path parts (ex: `[0]`) with the `@each` keyword and split.
  basePath = basePath.replace(/\[[^\]]+\]/g, ".@each");
  var parts = Path(basePath).split();
  var context = [];

  // For each changed key, walk down the data tree from the root to the data
  // element that triggered the event and add all relevent callbacks to this
  // object's TO_RENDER queue.
  while(1){
    let pre = context.join('.').trim();
    let post = parts.join('.').trim();

    for(let key in changed){
      let path = (post + (post && key && '.') + key).trim();
      for(let testPath in this.env.observers[pre]){
        if($.startsWith(testPath, path)){
          TO_RENDER.add(this.env.observers[pre][testPath]);
          ENV_QUEUE.add([this.env]);
        }
      }
    }
    if(parts.length === 0){ break; }
    context[context.length] = parts.shift();
  }

  // If Rebound is loaded in a testing environment, call renderCallback syncronously
  // so that changes to the data reflect in the DOM immediately.
  // TODO: Make tests async so this is not required
  if(window.Rebound && window.Rebound.testing){ return renderCallback(); }

  // Otherwise, queue our render callback to be called on the next animation frame,
  // after the current call stack has been exhausted.
  window.cancelAnimationFrame(RENDER_TIMEOUT);
  RENDER_TIMEOUT = window.requestAnimationFrame(renderCallback);
}


// A render function that will merge user provided helpers and hooks with our defaults
// and bind a method that re-renders dirty expressions on data change and executes
// other delegated listeners added by our hooks.
export default function render(el, template, data, options={}){

  // Fix for stupid Babel module importer
  // TODO: Fix this. This is dumb. Modules don't resolve in by time of this file's
  // execution because of the dependancy tree so babel doesn't get a chance to
  // interop the default value of these imports. We need to do this at runtime instead.
  var hooks = _hooks.default || _hooks;

  // If no data is passed to render, exit with an error
  if(!data){ return console.error('No data passed to render function.'); }

  // Every component's template is rendered using a unique Environment and Scope
  // If this component already has them, re-use the same objects – they contain
  // important state information. Otherwise, create fresh ones for it.
  var env = data.env || hooks.createFreshEnv();
  var scope = data.scope || hooks.createFreshScope();

  // Bind the component as the scope's main data object
  hooks.bindSelf(env, scope, data);

  // Add template specific hepers to env
  _.extend(env.helpers, options.helpers);

  // Save env and scope on component data to trigger lazy-value streams on data change
  data.env = env;
  data.scope = scope;

  // Save data on env to allow helpers / hooks access to component methods
  env.root = data;

  // Ensure we have a contextual element to pass to render
  options.contextualElement || (options.contextualElement = (data.el || document.body));
  options.self = data;

  // If data is an eventable object, run the onChange helper on any change
  if(data.listenTo){
    data.stopListening(null, null, onChange).stopListening(null, null, onReset).stopListening(null, null, onUpdate);
    data.listenTo(data, 'change', onChange).listenTo(data, 'reset', onReset).listenTo(data, 'update', onUpdate);
  }

  // If this is a real template, run it with our merged helpers and hooks
  // If there is no template, just return an empty fragment
  env.template = template ? hooks.buildRenderResult(template, env, scope, options) : { fragment: document.createDocumentFragment() };
  $(el).empty();
  el.appendChild(env.template.fragment);
  reslot(env);
  return el;
}
