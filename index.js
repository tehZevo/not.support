const express = require('express');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');
const app = express();

// Don't yell at me, please.
Array.prototype.random = function() {
  return this[Math.floor((Math.random()*this.length))];
}

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

const verbs = [ "is", "are" ];
const plurality = [ false, true ];
const prefixes = [];
const nsfwprefixes = [];

fs.readFileSync('./prefixes', 'utf8').split(/\n/).forEach(line => {
  line = (line.split(/(?:[^\\]#)/)[0] || "").trim()
  if (line.length == 0 || line.startsWith('#')) return;

  let nsfw = line.startsWith('!');
  if (nsfw) {
    nsfwprefixes.push(line.substring(1));
  } else {
    prefixes.push(line);
  }
  return line;
});

app.get('/', (req, res) => {
  if (req.subdomains.length > 0) {
    res.redirect('/ed');
    return;
  }

  res.render('index', {
    supporturl: req.query.supporturl || "",
    prefixes: prefixes
  });
});
app.get('/nolinefound', (req, res) => res.render('nolinefound'));
app.get('/get/support', (req, res) => {
  var thing = req.query.thing.replace(/ /g, '.');
  var verb = req.query.verb;
  var host = (/[^.]+\.[^.]+$/.exec(req.hostname) || ["localhost"])[0];
  var query = [];
  if (req.query.nsfw) query.push('nsfw');
  if (req.query.reason != -1) query.push('reason=' + req.query.reason);
  var querystr = query.join('&');
  var supporturl = `${req.protocol}://${thing}.${verb}.${host}/ed?${querystr}`;
  supporturl = supporturl.replace(/\.+/g, '.'); // Deduplicate periods
  supporturl = supporturl.replace(/[/]{2}\./, '//'); // Leading period after ://
  if (supporturl.length == 0) return res.redirect('/'); // :(
  res.redirect(`/?supporturl=` + encodeURIComponent(supporturl));
});

app.get('/ed', (req, res) => {
  // An array of space-seperated words
  var things = req.subdomains.slice(0);

  // Find the verb used in the subdomain, if any
  var verbIndex = verbs.indexOf(req.subdomains[0]);

  // Pick a verb or default, and remove the verb from 'things'
  if (verbIndex >= 0) {
    things.splice(0, 1);
  } else {
    verbIndex = 0;
  }
  var verb = verbs[verbIndex];
  var plural = plurality[verbIndex];

  // If 'things' is empty, redirect to the plain subdomain
  if (things.length == 0) {
    var host = /[^.]+\.[^.]+$/.exec(req.hostname)[0];
    res.redirect(req.protocol + '://' + host);
    return;
  }

  // Subdomains are implicitly in reverse order, which obv. isn't what we want.
  things = things.reverse();
  var thing = things.join(" ");

  // Choose a random prefix
  var filter = function(line) {
    if (/\$pluralonly/.test(line)) return plural;
    if (/\$singularonly/.test(line)) return !plural;
    return true;
  }
  var prefixdata = prefixes.filter(filter).random();
  var nsfw = typeof(req.query.nsfw) != 'undefined';
  if (nsfw) prefixdata = nsfwprefixes.filter(filter).random();

  // Optional prefix index override
  if (typeof(req.query.reason) != 'undefined') {
    var newIndex = Math.max(Math.min(req.query.reason, prefixes.length), 0);
    prefixdata = prefixes[newIndex] || prefixes.random();
  }

  if (!prefixdata) {
    console.log(`Couldn't find a matching line for${nsfw ? ' nsfw' : ''} request "${thing}"`);
    res.redirect('/nolinefound');
    return;
  }

  var prefix = prefixdata;
  var custom = false;

  prefix = prefix.replace(/^(.+)\s?\$content/, (match, prefix) => {
    return ejs.render(`<span class="prefix"><%= prefix %></span>` +
                      `<span class="thing"><%= thing %></span>`, {
      prefix: prefix,
      thing: thing
    });
  }).replace(/\$custom\s?(.+)/, (match, text) => {
    custom = true;
    var textsplit = /^(.+?)([.,!?])?$/.exec(text);
    return ejs.render(`<span class="not"><%= text %></span><%= punct %>`, {
      text: textsplit[1],
      punct: textsplit[2]
    });
  }).replace(/\$Content/, () => {
    return ejs.render(`<span class="thing"><%= thing %></span>`, {
      thing: thing[0].toUpperCase() + thing.substring(1)
    });
  }).replace(/\$CONTENT/, () => {
    var THING = thing.toUpperCase();
    return ejs.render(`<span class="thing"><%= thing %></span>`, {
      thing: thing.toUpperCase()
    });
  })
  .replace(/\$singular:([^ ]+)/g, (m, data) => plural ? '' : data)
  .replace(/\$plural:([^ ]+)/g, (m, data) => plural ? data : '')
  .replace(/\$[^ ]+/, '');

  if (!custom) {
    prefix += ejs.render(`
      <span class="prefix"><%= verb %></span>
      <span class="notsupported">
        <span class="not"      >not</span>
        <span class="supported">supported</span><!--
   --></span><!--
   --><span class="period">.</span>
    `, { verb: verb });
  }


  /*
  // Check if the prefix forces capitalization
  if (typeof prefixdata == 'string') {
    var capitalize = /[.!?]$/.test(prefixdata);
    var prefix = prefixdata;
    var postfix = "";
  } else {
    var capitalize = prefixdata[1];
    var postfix = prefixdata[2] || "";
    var prefix = prefixdata[0];
    var conditional = prefixdata[3];
    if (conditional && conditional[verbIndex]) {
      postfix += " " + conditional[verbIndex];
    }
  }

  // Enforce capitalization.
  var capAction = capitalize ? 'toUpperCase' : 'toLowerCase'
  var slicedFirstThing = things[0].split("");
  slicedFirstThing[0] = slicedFirstThing[0][capAction]();
  things[0] = slicedFirstThing.join(""); */



  // Serve up the text!
  res.render('support', { thing: prefix });
});
app.listen(8081);
