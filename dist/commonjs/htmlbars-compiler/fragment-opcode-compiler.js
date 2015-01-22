"use strict";
var TemplateVisitor = require("./template-visitor")["default"];
var processOpcodes = require("./utils").processOpcodes;
var forEach = require("../htmlbars-util/array-utils").forEach;

function FragmentOpcodeCompiler() {
  this.opcodes = [];
}

exports["default"] = FragmentOpcodeCompiler;

FragmentOpcodeCompiler.prototype.compile = function(ast) {
  var templateVisitor = new TemplateVisitor();
  templateVisitor.visit(ast);

  processOpcodes(this, templateVisitor.actions);

  return this.opcodes;
};

FragmentOpcodeCompiler.prototype.opcode = function(type, params) {
  this.opcodes.push([type, params]);
};

FragmentOpcodeCompiler.prototype.text = function(text, childIndex, childCount, isSingleRoot) {
  this.opcode('createText', [text.chars]);
  if (!isSingleRoot) { this.opcode('appendChild'); }
};

FragmentOpcodeCompiler.prototype.comment = function(comment, childIndex, childCount, isSingleRoot) {
  this.opcode('createComment', [comment.value]);
  if (!isSingleRoot) { this.opcode('appendChild'); }
};

FragmentOpcodeCompiler.prototype.openElement = function(element) {
  this.opcode('createElement', [element.tag]);
  forEach(element.attributes, this.attribute, this);
};

FragmentOpcodeCompiler.prototype.closeElement = function(element, childIndex, childCount, isSingleRoot) {
  if (!isSingleRoot) { this.opcode('appendChild'); }
};

FragmentOpcodeCompiler.prototype.startProgram = function(program) {
  this.opcodes.length = 0;
  if (program.body.length !== 1) {
    this.opcode('createFragment');
  }
};

FragmentOpcodeCompiler.prototype.endProgram = function(/* program */) {
  this.opcode('returnNode');
};

FragmentOpcodeCompiler.prototype.mustache = function () {};

FragmentOpcodeCompiler.prototype.component = function () {};

FragmentOpcodeCompiler.prototype.block = function () {};

FragmentOpcodeCompiler.prototype.attribute = function(attr) {
  if (attr.value.type === 'TextNode') {
    this.opcode('setAttribute', [attr.name, attr.value.chars]);
  }
};

FragmentOpcodeCompiler.prototype.setNamespace = function(namespace) {
  this.opcode('setNamespace', [namespace]);
};