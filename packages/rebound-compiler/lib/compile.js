// Rebound Compiler
// ----------------

import parse from "rebound-compiler/parser";
import { compileSpec, template } from "htmlbars-compiler/compiler";
import { merge } from "htmlbars-util/object-utils";
import DOMHelper from "dom-helper";
import helpers from "rebound-component/helpers";
import hooks from "rebound-component/hooks";
import Component from "rebound-component/component";

function compile(str, options={}){

  var str = parse(str, options);

  // Compile our template function
  var func = hooks.wrap(template(compileSpec(str.template)));

  if(str.isPartial){
    return helpers.registerPartial(options.name, func);
  } else{
    return Component.registerComponent(str.name, {
      prototype: eval(str.script),
      template: func,
      style: str.style
    });
  }
}

export default { compile };

