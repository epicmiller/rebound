// Rebound Hooks
// ----------------

import LazyValue from "rebound-component/lazy-value";
import $ from "rebound-component/utils";
import helpers, { partials } from "rebound-component/helpers";
import hooks, { wrapForHelper } from "htmlbars-runtime/hooks";
import DOMHelper from "dom-helper";
import { createObject } from "../htmlbars-util/object-utils";
import render from "htmlbars-runtime/render";



var attributes = {  abbr: 1,      "accept-charset": 1,   accept: 1,      accesskey: 1,     action: 1,
                    align: 1,      alink: 1,             alt: 1,         archive: 1,       axis: 1,
                    background: 1, bgcolor: 1,           border: 1,      cellpadding: 1,   cellspacing: 1,
                    char: 1,       charoff: 1,           charset: 1,     checked: 1,       cite: 1,
                    class: 1,      classid: 1,           clear: 1,       code: 1,          codebase: 1,
                    codetype: 1,   color: 1,             cols: 1,        colspan: 1,       compact: 1,
                    content: 1,    coords: 1,            data: 1,        datetime: 1,      declare: 1,
                    defer: 1,      dir: 1,               disabled: 1,    enctype: 1,       face: 1,
                    for: 1,        frame: 1,             frameborder: 1, headers: 1,       height: 1,
                    href: 1,       hreflang: 1,          hspace: 1,     "http-equiv": 1,   id: 1,
                    ismap: 1,      label: 1,             lang: 1,        language: 1,      link: 1,
                    longdesc: 1,   marginheight: 1,      marginwidth: 1, maxlength: 1,     media: 1,
                    method: 1,     multiple: 1,          name: 1,        nohref: 1,        noresize: 1,
                    noshade: 1,    nowrap: 1,            object: 1,      onblur: 1,        onchange: 1,
                    onclick: 1,    ondblclick: 1,        onfocus: 1,     onkeydown: 1,     onkeypress: 1,
                    onkeyup: 1,    onload: 1,            onmousedown: 1, onmousemove: 1,   onmouseout: 1,
                    onmouseover: 1,onmouseup: 1,         onreset: 1,     onselect: 1,      onsubmit: 1,
                    onunload: 1,   profile: 1,           prompt: 1,      readonly: 1,      rel: 1,
                    rev: 1,        rows: 1,              rowspan: 1,     rules: 1,         scheme: 1,
                    scope: 1,      scrolling: 1,         selected: 1,    shape: 1,         size: 1,
                    span: 1,       src: 1,               standby: 1,     start: 1,         style: 1,
                    summary: 1,    tabindex: 1,          target: 1,      text: 1,          title: 1,
                    type: 1,       usemap: 1,            valign: 1,      value: 1,         valuetype: 1,
                    version: 1,    vlink: 1,             vspace: 1,      width: 1  };


/*******************************
        Hook Utils
********************************/

// Given an object (context) and a path, create a LazyValue object that returns the value of object at context and add it as an observer of the context.
function streamProperty(context, path) {

  // Lazy value that returns the value of context.path
  var lazyValue = new LazyValue(function() {
    return context.get(path);
  }, {context: context});

  // Save our path so parent lazyvalues can know the data var or helper they are getting info from
  lazyValue.path = path;

  // Save the observer at this path
  lazyValue.addObserver(path, context);

  return lazyValue;
}

function streamHelper(morph, env, scope, visitor, params, hash, helper, templates, context){

  if(!_.isFunction(helper)) return console.error(scope + ' is not a valid helper!');

  // Create a lazy value that returns the value of our evaluated helper.
  var lazyValue = new LazyValue(function(){
    var plainParams = [],
        plainHash = {};

    // Assemble our args and hash variables. For each lazyvalue param, push the lazyValue's value so helpers with no concept of lazyvalues.
    _.each(params, function(param, index){
      plainParams.push(( (param && param.isLazyValue) ? param.value : param ));
    });
    _.each(hash, function(hash, key){
      plainHash[key] = (hash && hash.isLazyValue) ? hash.value : hash;
    });

    // Call our helper functions with our assembled args.
    return helper.call((context || {}), plainParams, plainHash, templates, env);

  }, {morph: morph, path: helper.name});

  // For each param or hash value passed to our helper, add it to our helper's dependant list. Helper will re-evaluate when one changes.
  params.forEach(function(param) {
    if (param && param.isLazyValue){ lazyValue.addDependentValue(param); }
  });
  for(var key in hash){
    if (hash[key] && hash[key].isLazyValue){ lazyValue.addDependentValue(hash[key]); }
  }
  lazyValue.value;
  return lazyValue;
};

hooks.invokeHelper = function invokeHelper(morph, env, scope, visitor, params, hash, helper, templates, context){
  return streamHelper.apply(this, arguments);
};

// Given a root element, cleans all of the morph lazyValues for a given subtree
function cleanSubtree(mutations, observer){
  // For each mutation observed, if there are nodes removed, destroy all associated lazyValues
  mutations.forEach(function(mutation) {
    if(mutation.removedNodes){
      _.each(mutation.removedNodes, function(node, index){
        $(node).walkTheDOM(function(n){
          if(n.__lazyValue && n.__lazyValue.destroy()){
            n.__lazyValue.destroy();
          }
        });
      });
    }
  });
}

// var subtreeObserver = new MutationObserver(cleanSubtree);

/*******************************
        Default Hooks
********************************/

// Helper Hooks

hooks.hasHelper = helpers.hasHelper;

hooks.lookupHelper = helpers.lookupHelper;

// Rebound's default environment
// The application environment is propagated down each render call and
// augmented with helpers as it goes
hooks.createFreshEnv = function(){
  return {
    helpers: helpers,
    hooks: hooks,
    dom: new DOMHelper.default(),
    useFragmentCache: true,
    revalidateQueue: {},
    isReboundEnv: true
  };
}

hooks.createChildEnv = function(parent){
  var env = createObject(parent);
  env.helpers = createObject(parent.helpers);
  return env;
}

hooks.wrap = function wrap(template){
  // Return a wrapper function that will merge user provided helpers and hooks with our defaults
  return {
    reboundTemplate: true,
    meta: template.meta,
    arity: template.arity,
    raw: template,
    render: function(data, env=hooks.createFreshEnv(), options={}, blockArguments){
      // Create a fresh scope if it doesn't exist
      var scope = hooks.createFreshScope();

      env = hooks.createChildEnv(env);
      _.extend(env.helpers, options.helpers);

      // Ensure we have a contextual element to pass to render
      options.contextualElement || (options.contextualElement = document.body);
      options.self = data;
      options.blockArguments = blockArguments;

      // Call our func with merged helpers and hooks
      env.template = render.default(template, env, scope, options);
      env.template.uid = _.uniqueId('template');
      return env.template;
    }
  };
};

// Scope Hooks
hooks.bindScope = function bindScope(env, scope){
  env.scope = scope;
  // Initial setup of scope
};

function rerender(path, node, lazyValue, env){
  lazyValue.onNotify(function(){
    node.isDirty = true;
    env.revalidateQueue[env.template.uid] = env.template;
  });
}

hooks.linkRenderNode = function linkRenderNode(renderNode, env, scope, path, params, hash){

  // Save the path on our render node for easier debugging
  renderNode.path = path;

  if (params && params.length) {
    for (var i = 0; i < params.length; i++) {
      if(params[i].isLazyValue)
        rerender(path, renderNode, params[i], env);
    }
  }
  if (hash) {
    for (var key in hash) {
      if(hash.hasOwnProperty(key) && hash[key].isLazyValue)
        rerender(path, renderNode, hash[key], env);
    }
  }
  return;
};


// Hooks

hooks.get = function get(env, scope, path){
    if(path === 'this') path = '';
    var key, value,
        rest = $.splitPath(path);
    key = rest.shift();

    // If this path referances a block param, use that as the context instead.
    if(scope.localPresent[key]){
      value = scope.locals[key];
      path = rest.join('.');
    }
    else{
      value = scope.self;
    }

    return streamProperty(value, path);
};

hooks.getValue = function(referance){
  return (referance && referance.isLazyValue) ? referance.value : referance;
};

hooks.subexpr = function subexpr(env, scope, helperName, params, hash) {
  var helper = helpers.lookupHelper(helperName, env),
  lazyValue;

  if (helper) {
    lazyValue = streamHelper(null, env, scope, null, params, hash, helper, {}, null);
  } else {
    lazyValue = hooks.get(env, context, helperName);
  }

  for (var i = 0, l = params.length; i < l; i++) {
    if(params[i].isLazyValue) {
      lazyValue.addDependentValue(params[i]);
    }
  }

  return lazyValue;
};

hooks.concat = function concat(env, params){

    if(params.length === 1){
      return params[0];
    }

    var lazyValue = new LazyValue(function() {
      var value = "";

      for (var i = 0, l = params.length; i < l; i++) {
        value += (params[i].isLazyValue) ? params[i].value : params[i];
      }

      return value;
    }, {context: params[0].context});

    for (var i = 0, l = params.length; i < l; i++) {
      if(params[i].isLazyValue) {
        lazyValue.addDependentValue(params[i]);
      }
    }

    return lazyValue;

};

// Content Hook
hooks.content = function content(morph, env, context, path, lazyValue){
  var lazyValue,
      value,
      observer = subtreeObserver,
      domElement = morph.contextualElement,
      helper = helpers.lookupHelper(path, env);

      lazyValue.onNotify(lazyValue.value);
      return lazyValue.value;

  var renderHook = function(lazyValue) {
    var val = lazyValue.value || '';
    if(!_.isNull(val)) morph.setContent(val);
  }

  var updateTextarea = function(lazyValue){
    domElement.value = lazyValue.value;
  }

  // If we have our lazy value, update our dom.
  // morph is a morph element representing our dom node
  lazyValue.onNotify(lazyValue.value);
  lazyValue.value

  // Two way databinding for textareas
  if(domElement.tagName === 'TEXTAREA'){
    lazyValue.onNotify(updateTextarea);
    $(domElement).on('change keyup', function(event){
      lazyValue.set(lazyValue.path, this.value);
    });
  }
};

hooks.attribute = function attribute(attrMorph, env, scope, name, value){
  // var lazyValue = new LazyValue(function(){
    var val = value.isLazyValue ? value.value : value,
        domElement = attrMorph.element,
        checkboxChange,
        type = domElement.getAttribute("type"),
        attr,
        inputTypes = {  'null': true,  'text':true,   'email':true,  'password':true,
                        'search':true, 'url':true,    'tel':true,    'hidden':true,
                        'number':true, 'color': true, 'date': true,  'datetime': true,
                        'datetime-local:': true,      'month': true, 'range': true,
                        'time': true,  'week': true
                      };

    // If is a text input element's value prop with only one variable, wire default events
    if( domElement.tagName === 'INPUT' && inputTypes[type] && name === 'value' ){

      // If our special input events have not been bound yet, bind them and set flag
      if(!attrMorph.inputObserver){

        $(domElement).on('change input propertychange', function(event){
          value.set(value.path, this.value);
        });

        attrMorph.inputObserver = true;

      }

      // Set the attribute on our element for visual referance
      (_.isUndefined(val)) ? domElement.removeAttribute(name) : domElement.setAttribute(name, val);

      attr = val;

      return (domElement.value !== String(attr)) ? domElement.value = (attr || '') : attr;
    }

    else if( domElement.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio') && name === 'checked' ){

      // If our special input events have not been bound yet, bind them and set flag
      if(!attrMorph.eventsBound){

        $(domElement).on('change propertychange', function(event){
          value.set(value.path, ((this.checked) ? true : false), {quiet: true});
        });

        attrMorph.eventsBound = true;
      }

      // Set the attribute on our element for visual referance
      (!val) ? domElement.removeAttribute(name) : domElement.setAttribute(name, val);

      return domElement.checked = (val) ? true : undefined;
    }

    // Special case for link elements with dynamic classes.
    // If the router has assigned it a truthy 'active' property, ensure that the extra class is present on re-render.
    else if( domElement.tagName === 'A' && name === 'class' ){
      if(_.isUndefined(val)){
        domElement.active ? domElement.setAttribute('class', 'active') : domElement.classList.remove('class');
      }
      else{
        domElement.setAttribute(name, val + (domElement.active ? ' active' : ''));
      }
    }

    else {
      _.isString(val) && (val = val.trim());
      val || (val = undefined);
      if(_.isUndefined(val)){
        domElement.removeAttribute(name);
      }
      else{
        domElement.setAttribute(name, val);
      }
    }

  //   return val;
  //
  // }, {attrMorph: attrMorph});
  //
  // lazyValue.addDependentValue(value);
  hooks.linkRenderNode(attrMorph, env, scope, '@attribute', [value], {});
  // lazyValue.value();

};

hooks.partial = function partial(renderNode, env, scope, path){
  var partial = partials[path];
  if( partial && partial.render ){
    env = Object.create(env);
    env.template = partial.render(scope.self, env, {contextualElement: renderNode.contextualElement}, scope.block);
    window.wewt = env.template;
    return env.template.fragment;
  }
};

// hooks.component = function component(statement, morph, env, scope){
//
// };

export default hooks;


//
//
// hooks.get = function get(env, context, path){
//   if(path === 'this') path = '';
//   var key,
//       rest = $.splitPath(path),
//       first = rest.shift();
//
//   // If this path referances a block param, use that as the context instead.
//   if(env.blockParams && env.blockParams[first]){
//     context = env.blockParams[first];
//     path = rest.join('.');
//   }
//
//   return streamProperty(context, path);
// };
//
// hooks.set = function set(env, context, name, value){
//   env.blockParams || (env.blockParams = {});
//   env.blockParams[name] = value;
// };
//
//
// hooks.concat = function concat(env, params) {
//
//   if(params.length === 1){
//     return params[0];
//   }
//
//   var lazyValue = new LazyValue(function() {
//     var value = "";
//
//     for (var i = 0, l = params.length; i < l; i++) {
//       value += (params[i].isLazyValue) ? params[i].value() : params[i];
//     }
//
//     return value;
//   }, {context: params[0].context});
//
//   for (var i = 0, l = params.length; i < l; i++) {
//     if(params[i].isLazyValue) {
//       lazyValue.addDependentValue(params[i]);
//     }
//   }
//
//   return lazyValue;
//
// };
//
//
// hooks.block = function block(env, morph, context, path, params, hash, template, inverse){
//   var options = {
//     morph: morph,
//     template: template,
//     inverse: inverse
//   };
//
//   var lazyValue,
//       value,
//       observer = subtreeObserver,
//       helper = helpers.lookupHelper(path, env);
//
//   if(!_.isFunction(helper)){
//     return console.error(path + ' is not a valid helper!');
//   }
//
//   // Abstracts our helper to provide a handlebars type interface. Constructs our LazyValue.
//   lazyValue = constructHelper(morph, path, context, params, hash, options, env, helper);
//
//   var renderHook = function(lazyValue) {
//     var val = lazyValue.value();
//     val = (_.isUndefined(val)) ? '' : val;
//     if(!_.isNull(val)){
//       morph.setContent(val);
//     }
//   }
//   lazyValue.onNotify(renderHook);
//   renderHook(lazyValue);
//
//   // Observe this content morph's parent's children.
//   // When the morph element's containing element (morph) is removed, clean up the lazyvalue.
//   // Timeout delay hack to give out dom a change to get their parent
//   if(morph._parent){
//     morph._parent.__lazyValue = lazyValue;
//     setTimeout(function(){
//       if(morph.contextualElement){
//         observer.observe(morph.contextualElement, { attributes: false, childList: true, characterData: false, subtree: true });
//       }
//     }, 0);
//   }
// };
//
// hooks.inline = function inline(env, morph, context, path, params, hash) {
//
//   var lazyValue,
//   value,
//   observer = subtreeObserver,
//   helper = helpers.lookupHelper(path, env);
//
//   if(!_.isFunction(helper)){
//     return console.error(path + ' is not a valid helper!');
//   }
//
//   // Abstracts our helper to provide a handlebars type interface. Constructs our LazyValue.
//   lazyValue = constructHelper(morph, path, context, params, hash, {}, env, helper);
//
//   var renderHook = function(lazyValue) {
//     var val = lazyValue.value();
//     val = (_.isUndefined(val)) ? '' : val;
//     if(!_.isNull(val)){
//       morph.setContent(val);
//     }
//   }
//
//   // If we have our lazy value, update our dom.
//   // morph is a morph element representing our dom node
//   lazyValue.onNotify(renderHook);
//   renderHook(lazyValue)
//
//   // Observe this content morph's parent's children.
//   // When the morph element's containing element (morph) is removed, clean up the lazyvalue.
//   // Timeout delay hack to give out dom a change to get their parent
//   if(morph._parent){
//     morph._parent.__lazyValue = lazyValue;
//     setTimeout(function(){
//       if(morph.contextualElement){
//         observer.observe(morph.contextualElement, { attributes: false, childList: true, characterData: false, subtree: true });
//       }
//     }, 0);
//   }
//
// };
//
// hooks.content = function content(env, morph, context, path) {
//   var lazyValue,
//       value,
//       observer = subtreeObserver,
//       domElement = morph.contextualElement,
//       helper = helpers.lookupHelper(path, env);
//
//   if (helper) {
//     lazyValue = constructHelper(morph, path, context, [], {}, {}, env, helper);
//   } else {
//     lazyValue = hooks.get(env, context, path);
//   }
//
//   var renderHook = function(lazyValue) {
//     var val = lazyValue.value();
//     val = (_.isUndefined(val)) ? '' : val;
//     if(!_.isNull(val)) morph.setContent(val);
//   }
//
//   var updateTextarea = function(lazyValue){
//     domElement.value = lazyValue.value();
//   }
//
//   // If we have our lazy value, update our dom.
//   // morph is a morph element representing our dom node
//   lazyValue.onNotify(renderHook);
//   renderHook(lazyValue);
//
//   // Two way databinding for textareas
//   if(domElement.tagName === 'TEXTAREA'){
//     lazyValue.onNotify(updateTextarea);
//     $(domElement).on('change keyup', function(event){
//       lazyValue.set(lazyValue.path, this.value);
//     });
//   }
//
//   // Observe this content morph's parent's children.
//   // When the morph element's containing element (morph) is removed, clean up the lazyvalue.
//   // Timeout delay hack to give out dom a change to get their parent
//   if(morph._parent){
//     morph._parent.__lazyValue = lazyValue;
//     setTimeout(function(){
//       if(morph.contextualElement){
//         observer.observe(morph.contextualElement, { attributes: false, childList: true, characterData: false, subtree: true });
//       }
//     }, 0);
//   }
//
// };
//
// // Handle morphs in element tags
// // TODO: handle dynamic attribute names?
// hooks.element = function element(env, domElement, context, path, params, hash) {
//   var helper = helpers.lookupHelper(path, env),
//       lazyValue,
//       value;
//
//   if (helper) {
//     // Abstracts our helper to provide a handlebars type interface. Constructs our LazyValue.
//     lazyValue = constructHelper(domElement, path, context, params, hash, {}, env, helper);
//   } else {
//     lazyValue = hooks.get(env, context, path);
//   }
//
//   var renderHook = function(lazyValue) {
//     lazyValue.value();
//   }
//
//   // When we have our lazy value run it and start listening for updates.
//   lazyValue.onNotify(renderHook);
//   renderHook(lazyValue);
//
// };
// hooks.attribute = function attribute(env, attrMorph, domElement, name, value){
//
//   var lazyValue = new LazyValue(function() {
//     var val = value.value(),
//     checkboxChange,
//     type = domElement.getAttribute("type"),
//
//     inputTypes = {  'null': true,  'text':true,   'email':true,  'password':true,
//                     'search':true, 'url':true,    'tel':true,    'hidden':true,
//                     'number':true, 'color': true, 'date': true,  'datetime': true,
//                     'datetime-local:': true,      'month': true, 'range': true,
//                     'time': true,  'week': true
//                   },
//     attr;
//
//     // If is a text input element's value prop with only one variable, wire default events
//     if( domElement.tagName === 'INPUT' && inputTypes[type] && name === 'value' ){
//
//       // If our special input events have not been bound yet, bind them and set flag
//       if(!lazyValue.inputObserver){
//
//         $(domElement).on('change input propertychange', function(event){
//           value.set(value.path, this.value);
//         });
//
//         lazyValue.inputObserver = true;
//
//       }
//
//       // Set the attribute on our element for visual referance
//       (_.isUndefined(val)) ? domElement.removeAttribute(name) : domElement.setAttribute(name, val);
//
//       attr = val;
//
//       return (domElement.value !== String(attr)) ? domElement.value = (attr || '') : attr;
//     }
//
//     else if( domElement.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio') && name === 'checked' ){
//
//       // If our special input events have not been bound yet, bind them and set flag
//       if(!lazyValue.eventsBound){
//
//         $(domElement).on('change propertychange', function(event){
//           value.set(value.path, ((this.checked) ? true : false), {quiet: true});
//         });
//
//         lazyValue.eventsBound = true;
//       }
//
//       // Set the attribute on our element for visual referance
//       (!val) ? domElement.removeAttribute(name) : domElement.setAttribute(name, val);
//
//       return domElement.checked = (val) ? true : undefined;
//     }
//
//     // Special case for link elements with dynamic classes.
//     // If the router has assigned it a truthy 'active' property, ensure that the extra class is present on re-render.
//     else if( domElement.tagName === 'A' && name === 'class' ){
//       if(_.isUndefined(val)){
//         domElement.active ? domElement.setAttribute('class', 'active') : domElement.classList.remove('class');
//       }
//       else{
//         domElement.setAttribute(name, val + (domElement.active ? ' active' : ''));
//       }
//     }
//
//     else {
//       _.isString(val) && (val = val.trim());
//       val || (val = undefined);
//       if(_.isUndefined(val)){
//         domElement.removeAttribute(name);
//       }
//       else{
//         domElement.setAttribute(name, val);
//       }
//     }
//
//     return val;
//
//   }, {attrMorph: attrMorph});
//
//   var renderHook = function(){
//     lazyValue.value();
//   }
//
//   value.onNotify(renderHook);
//   lazyValue.addDependentValue(value);
//   renderHook();
// };

hooks.component = function(morph, env, scope, tagName, params, contextData, templates, visitor) {

  var component,
      template = templates.default,
      element,
      outlet,
      plainData = {},
      componentData = {},
      lazyValue,
      value;

  // Create a plain data object from the lazyvalues/values passed to our component
  _.each(contextData, function(value, key) {
    plainData[key] = (value.isLazyValue) ? value.value : value;
  });

  // For each param passed to our shared component, add it to our custom element
  // TODO: there has to be a better way to get seed data to element instances
  // Global seed data is consumed by element as its created. This is not scoped and very dumb.
  Rebound.seedData = plainData;
  element = document.createElement(tagName);
  delete Rebound.seedData;
  component = element['data'];

  // For each lazy param passed to our component, create its lazyValue
  _.each(plainData, function(value, key) {
    if(contextData[key] && contextData[key].isLazyValue){
      componentData[key] = streamProperty(component, key);
    }
  });

  // Set up two way binding between component and original context for non-data attributes
  // Syncing between models and collections passed are handled in model and collection
  _.each( componentData, function(componentDataValue, key){

    // TODO: Make this sync work with complex arguments with more than one child
    if(contextData[key].children === null){
      // For each lazy param passed to our component, have it update the original context when changed.
      componentDataValue.onNotify(function(){
        contextData[key].set(contextData[key].path, componentDataValue.value);
      });
    }

    // For each lazy param passed to our component, have it update the component when changed.
    contextData[key].onNotify(function(){
      componentDataValue.set(key, contextData[key].value);
    });

    // Seed the cache
    componentDataValue.value;

    // Notify the component's lazyvalue when our model updates
    contextData[key].addObserver(contextData[key].path, scope.locals.item);
    componentDataValue.addObserver(key, component);

  });

  // // For each change on our component, update the states of the original context and the element's proeprties.
  component.listenTo(component, 'change', function(model){
    var json = component.toJSON();

    if(_.isString(json)) return; // If is a string, this model is seralizing already

    // Set the properties on our element for visual referance if we are on a top level attribute
    _.each(json, function(value, key){
      // TODO: Currently, showing objects as properties on the custom element causes problems.
      // Linked models between the context and component become the same exact model and all hell breaks loose.
      // Find a way to remedy this. Until then, don't show objects.
      if((_.isObject(value))){ return; }
      value = (_.isObject(value)) ? JSON.stringify(value) : value;
        try{ (attributes[key]) ? element.setAttribute(key, value) : element.dataset[key] = value; }
        catch(e){
          console.error(e.message);
        }
    });
  });

  /** The attributeChangedCallback on our custom element updates the component's data. **/


/*******************************************************

  End data dependancy chain

*******************************************************/


  // TODO: break this out into its own function
  // Set the properties on our element for visual referance if we are on a top level attribute
  var compjson = component.toJSON();
  _.each(compjson, function(value, key){
    // TODO: Currently, showing objects as properties on the custom element causes problems.
    // Linked models between the context and component become the same exact model and all hell breaks loose.
    // Find a way to remedy this. Until then, don't show objects.
    if((_.isObject(value))){ return; }
    value = (_.isObject(value)) ? JSON.stringify(value) : value;
    if(!_.isNull(value) && !_.isUndefined(value)){
      try{ (attributes[key]) ? element.setAttribute(key, value) : element.dataset[key] = value; }
      catch(e){
        console.error(e.message);
      }
    }
  });


  // Walk the dom, without traversing into other custom elements, and search for
  // `<content>` outlets to render templates into.
  $(element).walkTheDOM(function(el){
    if(element === el) return true;
    if(el.tagName === 'CONTENT') outlet = el;
    if(el.tagName.indexOf('-') > -1) return false;
    return true;
  })

  // If a `<content>` outlet is present in component's template, and a template
  // is provided, render it into the outlet
  if(template && _.isElement(outlet)){
    outlet.innerHTML = '';
    outlet.appendChild(render.default(template, env, scope, {}).fragment);
  }

  morph.setNode(element);

};