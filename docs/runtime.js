/* Minimal runtime for the Touladi prototype: renders the <template id="tpl"> markup
   ({{holes}}, <sc-if>, <sc-for>, events) with React, driven by `class Component extends DCLogic`. */
var h = React.createElement;

var ATTR_MAP = {
  "class": "className", "for": "htmlFor", "autocomplete": "autoComplete", "inputmode": "inputMode",
  "tabindex": "tabIndex", "readonly": "readOnly", "maxlength": "maxLength",
  "onclick": "onClick", "onchange": "onChange", "oninput": "onInput", "viewbox": "viewBox"
};
var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

function camel(s) { return s.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); }); }

function lookup(path, scope) {
  path = path.trim();
  if (path === "true") return true;
  if (path === "false") return false;
  if (path === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  var parts = path.split(".");
  var v = scope[parts[0]];
  for (var i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
  return v;
}

function interp(str, scope) {
  var m = str.match(WHOLE);
  if (m) return lookup(m[1], scope);
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, p) {
    var v = lookup(p, scope);
    return v == null ? "" : String(v);
  });
}

function parseStyle(s) {
  var o = {};
  String(s).split(";").forEach(function (decl) {
    var i = decl.indexOf(":");
    if (i < 0) return;
    var k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
    if (!k) return;
    if (k.indexOf("--") === 0) { o[k] = v; return; }
    if (k.indexOf("-webkit-") === 0) { var c = camel(k.slice(8)); k = "Webkit" + c.charAt(0).toUpperCase() + c.slice(1); }
    else k = camel(k);
    o[k] = v;
  });
  return o;
}

function kids(node, scope) {
  var out = [], i = 0;
  node.childNodes.forEach(function (c) {
    var r = conv(c, scope, i++);
    if (r !== null && r !== undefined && r !== "") out.push(r);
  });
  return out;
}

function conv(node, scope, key) {
  if (node.nodeType === 3) {
    var t = node.nodeValue;
    if (!t.trim()) return null;
    return t.indexOf("{{") >= 0 ? interp(t, scope) : t;
  }
  if (node.nodeType !== 1) return null;
  var tag = node.localName;

  if (tag === "sc-if") {
    var cond = interp(node.getAttribute("value") || "", scope);
    return cond ? h.apply(null, [React.Fragment, { key: key }].concat(kids(node, scope))) : null;
  }
  if (tag === "sc-for") {
    var list = interp(node.getAttribute("list") || "", scope) || [];
    var as = node.getAttribute("as") || "item";
    return h(React.Fragment, { key: key }, list.map(function (it, idx) {
      var sc = Object.assign({}, scope); sc[as] = it; sc.$index = idx;
      return h.apply(null, [React.Fragment, { key: idx }].concat(kids(node, sc)));
    }));
  }

  var props = { key: key };
  for (var a = 0; a < node.attributes.length; a++) {
    var attr = node.attributes[a];
    var name = attr.name;
    if (name.indexOf("hint-") === 0) continue;
    var val = attr.value.indexOf("{{") >= 0 ? interp(attr.value, scope) : attr.value;
    if (name === "style") { props.style = parseStyle(val); continue; }
    var lower = name.toLowerCase();
    if (ATTR_MAP[lower]) name = ATTR_MAP[lower];
    else if (lower.indexOf("aria-") !== 0 && lower.indexOf("data-") !== 0 && name.indexOf("-") >= 0) name = camel(name);
    props[name] = val;
  }
  if (tag === "form") props.onSubmit = function (e) { e.preventDefault(); };
  if (tag === "input" && props.type === "checkbox") {
    props.checked = props.checked === true || props.checked === "true";
    if (!props.onChange) props.readOnly = true;
  }
  if ("value" in props && props.value === undefined) delete props.value;
  if ((tag === "input" || tag === "textarea" || tag === "select") && "value" in props && !props.onChange) {
    props.defaultValue = props.value; delete props.value;
  }
  if (tag === "textarea") return h(tag, props);
  return h.apply(null, [tag, props].concat(kids(node, scope)));
}

var TPL = null;
var DCLogic = class extends React.Component {
  render() {
    if (!TPL) TPL = document.getElementById("tpl").content;
    return h.apply(null, [React.Fragment, null].concat(kids(TPL, this.renderVals())));
  }
};
