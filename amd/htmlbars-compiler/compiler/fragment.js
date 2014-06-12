define("htmlbars-compiler/compiler/fragment", 
  ["./utils","./quoting","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var processOpcodes = __dependency1__.processOpcodes;
    var string = __dependency2__.string;

    function FragmentCompiler() {
      this.source = [];
      this.depth = 0;
    }

    __exports__.FragmentCompiler = FragmentCompiler;FragmentCompiler.prototype.compile = function(opcodes) {
      this.source.length = 0;
      this.depth = 0;

      this.source.push('function build(dom) {\n');
      processOpcodes(this, opcodes);
      this.source.push('}\n');

      return this.source.join('');
    };

    FragmentCompiler.prototype.empty = function() {
      this.source.push('  return dom.createDocumentFragment();\n');
    };

    FragmentCompiler.prototype.startFragment = function() {
      this.source.push('  var el0 = dom.createDocumentFragment();\n');
    };

    FragmentCompiler.prototype.endFragment = function() {
      this.source.push('  return el0;\n');
    };

    FragmentCompiler.prototype.openRootElement = function(tagName) {
      this.source.push('  var el0 = dom.createElement('+string(tagName)+');\n');
    };

    FragmentCompiler.prototype.closeRootElement = function() {
      this.source.push('  return el0;\n');
    };

    FragmentCompiler.prototype.rootText = function(str) {
      this.source.push('  return dom.createTextNode('+string(str)+');\n');
    };

    FragmentCompiler.prototype.openElement = function(tagName) {
      var el = 'el'+(++this.depth);
      this.source.push('  var '+el+' = dom.createElement('+string(tagName)+');\n');
    };

    FragmentCompiler.prototype.setAttribute = function(name, value) {
      var el = 'el'+this.depth;
      this.source.push('  dom.setAttribute('+el+','+string(name)+','+string(value)+');\n');
    };

    FragmentCompiler.prototype.text = function(str) {
      var el = 'el'+this.depth;
      this.source.push('  dom.appendText('+el+','+string(str)+');\n');
    };

    FragmentCompiler.prototype.closeElement = function() {
      var child = 'el'+(this.depth--);
      var el = 'el'+this.depth;
      this.source.push('  dom.appendChild('+el+', '+child+');\n');
    };
  });